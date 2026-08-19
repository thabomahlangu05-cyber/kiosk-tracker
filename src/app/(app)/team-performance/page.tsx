import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CHECKLIST_PHASE, ROLE_LABELS } from "@/lib/enums";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Each column is weighted by how much work it represents: finishing a whole
 * unit is worth more than ticking one checklist task. Weights live here so
 * the scoring is visible rather than buried in a query.
 */
const WEIGHTS = {
  repairTasks: 1,
  qaChecks: 1,
  housekeeping: 1,
  partsIssued: 1,
  unitsCompleted: 5,
} as const;

interface Row {
  id: string;
  name: string;
  role: string;
  repairTasks: number;
  qaChecks: number;
  housekeeping: number;
  partsIssued: number;
  unitsCompleted: number;
  score: number;
}

function ratingFor(score: number, best: number) {
  if (best === 0 || score === 0)
    return { label: "No activity", tone: "slate" as const };
  const share = score / best;
  if (share >= 0.8) return { label: "Excellent", tone: "green" as const };
  if (share >= 0.5) return { label: "Strong", tone: "blue" as const };
  if (share >= 0.25) return { label: "Steady", tone: "amber" as const };
  return { label: "Building up", tone: "slate" as const };
}

export default async function TeamPerformancePage() {
  await requireUser();

  const [users, repair, qa, housekeeping, parts, units] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.repairChecklistItem.groupBy({
      by: ["assignedToId"],
      where: { completed: true, phase: CHECKLIST_PHASE.REPAIR },
      _count: { _all: true },
    }),
    prisma.repairChecklistItem.groupBy({
      by: ["assignedToId"],
      where: { completed: true, phase: CHECKLIST_PHASE.QA },
      _count: { _all: true },
    }),
    prisma.housekeepingTask.groupBy({
      by: ["assignedToId"],
      where: { status: "COMPLETED" },
      _count: { _all: true },
    }),
    prisma.partRequest.groupBy({
      by: ["fulfilledById"],
      where: { status: "ISSUED" },
      _count: { _all: true },
    }),
    prisma.job.groupBy({
      by: ["assignedTechId"],
      where: { status: "COMPLETED" },
      _count: { _all: true },
    }),
  ]);

  const tally = (
    rows: { _count: { _all: number } }[],
    key: string,
    getId: (r: never) => string | null,
  ) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const id = getId(r as never);
      if (id) map.set(id, r._count._all);
    }
    return map;
  };

  const repairMap = tally(repair, "assignedToId", (r: never) =>
    (r as { assignedToId: string | null }).assignedToId,
  );
  const qaMap = tally(qa, "assignedToId", (r: never) =>
    (r as { assignedToId: string | null }).assignedToId,
  );
  const hkMap = tally(housekeeping, "assignedToId", (r: never) =>
    (r as { assignedToId: string | null }).assignedToId,
  );
  const partsMap = tally(parts, "fulfilledById", (r: never) =>
    (r as { fulfilledById: string | null }).fulfilledById,
  );
  const unitsMap = tally(units, "assignedTechId", (r: never) =>
    (r as { assignedTechId: string | null }).assignedTechId,
  );

  const rows: Row[] = users.map((u) => {
    const repairTasks = repairMap.get(u.id) ?? 0;
    const qaChecks = qaMap.get(u.id) ?? 0;
    const hk = hkMap.get(u.id) ?? 0;
    const partsIssued = partsMap.get(u.id) ?? 0;
    const unitsCompleted = unitsMap.get(u.id) ?? 0;
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      repairTasks,
      qaChecks,
      housekeeping: hk,
      partsIssued,
      unitsCompleted,
      score:
        repairTasks * WEIGHTS.repairTasks +
        qaChecks * WEIGHTS.qaChecks +
        hk * WEIGHTS.housekeeping +
        partsIssued * WEIGHTS.partsIssued +
        unitsCompleted * WEIGHTS.unitsCompleted,
    };
  });

  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const best = rows.length > 0 ? rows[0].score : 0;
  const totals = rows.reduce(
    (acc, r) => ({
      repairTasks: acc.repairTasks + r.repairTasks,
      qaChecks: acc.qaChecks + r.qaChecks,
      housekeeping: acc.housekeeping + r.housekeeping,
      unitsCompleted: acc.unitsCompleted + r.unitsCompleted,
    }),
    { repairTasks: 0, qaChecks: 0, housekeeping: 0, unitsCompleted: 0 },
  );
  const active = rows.filter((r) => r.score > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Team Performance</h1>
        <p className="text-sm text-gray-400">
          Everything each person has completed across the floor
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Repair tasks" value={totals.repairTasks} />
        <StatCard label="QA checks" value={totals.qaChecks} />
        <StatCard label="Housekeeping" value={totals.housekeeping} />
        <StatCard
          label="Contributing"
          value={`${active}/${rows.length}`}
          hint="people with activity"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Performance matrix" />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Person</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 text-right font-medium">Repair</th>
                  <th className="px-4 py-3 text-right font-medium">QA</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Housekeeping
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Parts issued
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Units</th>
                  <th className="px-4 py-3 text-right font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((r, i) => {
                  const rating = ratingFor(r.score, best);
                  const share = best > 0 ? Math.round((r.score / best) * 100) : 0;
                  return (
                    <tr key={r.id} className="hover:bg-[var(--border)]/40">
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-white">
                        {r.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ??
                          r.role}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {r.repairTasks}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {r.qaChecks}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {r.housekeeping}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {r.partsIssued}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {r.unitsCompleted}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {r.score}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--border)]">
                            <div
                              className="h-full rounded-full bg-[var(--primary)]"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                          <Badge tone={rating.tone}>{rating.label}</Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <p className="text-xs text-gray-500">
        Score weights each completed unit as {WEIGHTS.unitsCompleted} and every
        other completed item as {WEIGHTS.repairTasks}. Ratings are relative to
        the highest scorer, so they compare people against the floor rather than
        a fixed target.
      </p>
    </div>
  );
}
