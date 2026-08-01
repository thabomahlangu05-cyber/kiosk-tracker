import { prisma } from "./db";
import { JOB_STATUS, MOVEMENT_TYPES, QA_RESULT } from "./enums";

export interface FpyResult {
  inspectedJobs: number; // jobs that have reached QA at least once
  firstPassJobs: number; // jobs whose FIRST inspection passed
  yieldPct: number | null; // null when nothing inspected yet
  totalInspections: number;
  failCount: number;
}

/**
 * First-pass yield: of the units that have been through QA, the share whose
 * very first inspection passed. Rework = failed inspections.
 */
export async function firstPassYield(): Promise<FpyResult> {
  const inspections = await prisma.qAInspection.findMany({
    orderBy: { createdAt: "asc" },
    select: { jobId: true, result: true },
  });

  const firstByJob = new Map<string, string>();
  let failCount = 0;
  for (const i of inspections) {
    if (!firstByJob.has(i.jobId)) firstByJob.set(i.jobId, i.result);
    if (i.result === QA_RESULT.FAIL) failCount++;
  }

  const inspectedJobs = firstByJob.size;
  let firstPassJobs = 0;
  for (const r of firstByJob.values()) {
    if (r === QA_RESULT.PASS) firstPassJobs++;
  }

  return {
    inspectedJobs,
    firstPassJobs,
    yieldPct:
      inspectedJobs === 0
        ? null
        : Math.round((firstPassJobs / inspectedJobs) * 100),
    totalInspections: inspections.length,
    failCount,
  };
}

export interface DefectRow {
  name: string;
  count: number;
}

/** Count of logged defects grouped by defect type, most frequent first. */
export async function defectBreakdown(): Promise<DefectRow[]> {
  const grouped = await prisma.defect.groupBy({
    by: ["defectTypeId"],
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  const types = await prisma.defectType.findMany({
    where: { id: { in: grouped.map((g) => g.defectTypeId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(types.map((t) => [t.id, t.name]));

  return grouped
    .map((g) => ({
      name: nameById.get(g.defectTypeId) ?? "Unknown",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface LowStockPart {
  id: string;
  sku: string;
  name: string;
  quantityOnHand: number;
  reorderLevel: number;
}

export interface PartsSummary {
  totalParts: number;
  lowStock: LowStockPart[];
  stockValue: number; // Σ quantityOnHand × unitCost
  issuedQty: number; // total quantity issued to jobs
  consumptionCost: number; // Σ issued qty × current unit cost
}

/**
 * Parts inventory summary: stock value, low-stock items, and consumption
 * (parts issued to jobs). Consumption cost uses each part's current unit cost.
 */
export async function partsConsumption(): Promise<PartsSummary> {
  const parts = await prisma.part.findMany();
  const lowStock = parts
    .filter((p) => p.quantityOnHand <= p.reorderLevel)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      quantityOnHand: p.quantityOnHand,
      reorderLevel: p.reorderLevel,
    }));
  const stockValue = parts.reduce(
    (s, p) => s + p.quantityOnHand * p.unitCost,
    0,
  );

  const issues = await prisma.stockMovement.findMany({
    where: { type: MOVEMENT_TYPES.ISSUE },
    include: { part: true },
  });
  const issuedQty = issues.reduce((s, m) => s + m.quantity, 0);
  const consumptionCost = issues.reduce(
    (s, m) => s + m.quantity * m.part.unitCost,
    0,
  );

  return {
    totalParts: parts.length,
    lowStock,
    stockValue,
    issuedQty,
    consumptionCost,
  };
}

export interface CountRow {
  label: string;
  count: number;
}

export interface ThroughputResult {
  total: number;
  byDay: CountRow[];
  byTeam: CountRow[];
  byTech: CountRow[];
}

/** Completed-unit throughput within a date range, grouped by day / team / technician. */
export async function throughput(from: Date, to: Date): Promise<ThroughputResult> {
  const jobs = await prisma.job.findMany({
    where: {
      status: JOB_STATUS.COMPLETED,
      completedAt: { gte: from, lte: to },
    },
    include: { assignedTeam: true, assignedTech: true },
  });

  const byDay = new Map<string, number>();
  const byTeam = new Map<string, number>();
  const byTech = new Map<string, number>();
  for (const j of jobs) {
    const day = j.completedAt!.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    const team = j.assignedTeam?.name ?? "Unassigned";
    byTeam.set(team, (byTeam.get(team) ?? 0) + 1);
    const tech = j.assignedTech?.name ?? "Unassigned";
    byTech.set(tech, (byTech.get(tech) ?? 0) + 1);
  }

  const rows = (m: Map<string, number>, byKey = false): CountRow[] =>
    [...m.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => (byKey ? a.label.localeCompare(b.label) : b.count - a.count));

  return {
    total: jobs.length,
    byDay: rows(byDay, true),
    byTeam: rows(byTeam),
    byTech: rows(byTech),
  };
}

export interface StageAvg {
  stage: string;
  kind: string;
  avgMs: number;
  count: number;
}

export interface TurnaroundResult {
  completedCount: number;
  avgEndToEndMs: number | null;
  perStage: StageAvg[];
}

/** Turnaround within a date range: average end-to-end and per-stage averages. */
export async function turnaround(from: Date, to: Date): Promise<TurnaroundResult> {
  const completed = await prisma.job.findMany({
    where: {
      status: JOB_STATUS.COMPLETED,
      completedAt: { gte: from, lte: to },
    },
    select: { createdAt: true, completedAt: true },
  });
  const e2e = completed.map((j) => j.completedAt!.getTime() - j.createdAt.getTime());
  const avgEndToEndMs = e2e.length
    ? e2e.reduce((a, b) => a + b, 0) / e2e.length
    : null;

  const transitions = await prisma.stageTransition.findMany({
    where: {
      exitedAt: { not: null },
      job: { createdAt: { gte: from, lte: to } },
    },
    include: { job: { select: { kind: true } } },
  });
  const agg = new Map<string, { kind: string; total: number; count: number }>();
  for (const t of transitions) {
    const dur = t.exitedAt!.getTime() - t.enteredAt.getTime();
    const key = `${t.job.kind}:${t.stage}`;
    const cur = agg.get(key) ?? { kind: t.job.kind, total: 0, count: 0 };
    cur.total += dur;
    cur.count += 1;
    agg.set(key, cur);
  }
  const perStage: StageAvg[] = [...agg.entries()]
    .map(([key, v]) => ({
      stage: key.split(":")[1],
      kind: v.kind,
      avgMs: v.total / v.count,
      count: v.count,
    }))
    .sort((a, b) => b.avgMs - a.avgMs);

  return { completedCount: completed.length, avgEndToEndMs, perStage };
}

export interface TechnicianPerf {
  techId: string;
  techName: string;
  teamName: string | null;
  completed: number;
  avgTurnaroundHours: number;
  passRate: number | null;
}

/**
 * Team performance: units completed, avg turnaround, pass rate per technician
 */
export async function teamPerformance(from: Date, to: Date): Promise<TechnicianPerf[]> {
  const jobs = await prisma.job.findMany({
    where: {
      status: JOB_STATUS.COMPLETED,
      completedAt: { gte: from, lte: to },
    },
    include: {
      assignedTech: { include: { team: true } },
      inspections: true,
    },
  });

  const perfMap = new Map<string, { name: string; team: string | null; jobs: typeof jobs }>();

  for (const job of jobs) {
    if (!job.assignedTechId) continue;
    const tech = job.assignedTech!;
    if (!perfMap.has(tech.id)) {
      perfMap.set(tech.id, {
        name: tech.name,
        team: tech.team?.name || null,
        jobs: [],
      });
    }
    perfMap.get(tech.id)!.jobs.push(job);
  }

  return Array.from(perfMap.entries())
    .map(([techId, { name, team, jobs }]) => {
      const totalMs = jobs.reduce((sum, j) => {
        if (!j.completedAt) return sum;
        return sum + (j.completedAt.getTime() - j.createdAt.getTime());
      }, 0);
      const avgTurnaroundHours = jobs.length > 0 ? totalMs / 3600000 / jobs.length : 0;

      const firstInspections = jobs
        .map((j) => j.inspections[0]?.result)
        .filter(Boolean);
      const passCount = firstInspections.filter((r) => r === QA_RESULT.PASS).length;
      const passRate = firstInspections.length > 0 ? (passCount / firstInspections.length) * 100 : null;

      return {
        techId,
        techName: name,
        teamName: team,
        completed: jobs.length,
        avgTurnaroundHours: Math.round(avgTurnaroundHours * 10) / 10,
        passRate: passRate ? Math.round(passRate) : null,
      };
    })
    .sort((a, b) => b.completed - a.completed);
}
