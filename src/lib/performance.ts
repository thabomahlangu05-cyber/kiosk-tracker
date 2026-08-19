import "server-only";
import { prisma } from "@/lib/db";
import { CHECKLIST_PHASE } from "@/lib/enums";

/**
 * Scoring counts the work people take on themselves: a task they claimed and
 * finished is worth more than one still in their hands, but both count. Nobody
 * is scored on kiosks — those aren't claimed any more.
 *
 * Shared by the Team Performance page and the slideshow's leaderboard slide so
 * the two can't drift apart.
 */
export const DONE_WEIGHT = 2;
export const OPEN_WEIGHT = 1;

export interface PerformanceRow {
  id: string;
  name: string;
  role: string;
  repairDone: number;
  qaDone: number;
  housekeepingDone: number;
  open: number;
  done: number;
  score: number;
}

export interface PerformanceData {
  rows: PerformanceRow[];
  best: number;
  totals: { done: number; open: number; repairDone: number; qaDone: number };
  active: number;
  /** Completions per day, oldest first, over the requested window. */
  series: [string, number][];
  peak: number;
}

function blank() {
  return {
    repairDone: 0,
    qaDone: 0,
    housekeepingDone: 0,
    open: 0,
    done: 0,
  };
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getPerformance(days = 14): Promise<PerformanceData> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  // Sequential on purpose. The serverless pool is capped at one connection
  // (src/lib/db.ts), so firing these together just makes two of them queue for
  // a checkout and risk the acquire timeout — with no gain, since they share
  // the one connection either way.
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  const checklist = await prisma.repairChecklistItem.findMany({
    where: { assignedToId: { not: null } },
    select: {
      assignedToId: true,
      phase: true,
      completed: true,
      completedAt: true,
    },
  });
  const housekeeping = await prisma.housekeepingTask.findMany({
    where: { assignedToId: { not: null } },
    select: { assignedToId: true, status: true, completedAt: true },
  });

  const acc = new Map<string, ReturnType<typeof blank>>();
  const bump = (id: string | null) => {
    if (!id) return null;
    if (!acc.has(id)) acc.set(id, blank());
    return acc.get(id)!;
  };

  for (const item of checklist) {
    const a = bump(item.assignedToId);
    if (!a) continue;
    if (item.completed) {
      a.done += 1;
      if (item.phase === CHECKLIST_PHASE.QA) a.qaDone += 1;
      else a.repairDone += 1;
    } else {
      a.open += 1;
    }
  }
  for (const task of housekeeping) {
    const a = bump(task.assignedToId);
    if (!a) continue;
    if (task.status === "COMPLETED") {
      a.done += 1;
      a.housekeepingDone += 1;
    } else {
      a.open += 1;
    }
  }

  const rows: PerformanceRow[] = users.map((u) => {
    const a = acc.get(u.id) ?? blank();
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      ...a,
      score: a.done * DONE_WEIGHT + a.open * OPEN_WEIGHT,
    };
  });
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const totals = rows.reduce(
    (t, r) => ({
      done: t.done + r.done,
      open: t.open + r.open,
      repairDone: t.repairDone + r.repairDone,
      qaDone: t.qaDone + r.qaDone,
    }),
    { done: 0, open: 0, repairDone: 0, qaDone: 0 },
  );

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(dayKey(d), 0);
  }
  const countDay = (at: Date | null) => {
    if (!at || at < since) return;
    const k = dayKey(at);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  };
  for (const i of checklist) if (i.completed) countDay(i.completedAt);
  for (const t of housekeeping)
    if (t.status === "COMPLETED") countDay(t.completedAt);

  const series = [...buckets.entries()];

  return {
    rows,
    best: rows.length > 0 ? rows[0].score : 0,
    totals,
    active: rows.filter((r) => r.score > 0).length,
    series,
    peak: Math.max(1, ...series.map(([, n]) => n)),
  };
}
