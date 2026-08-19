import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CHECKLIST_PHASE, ROLE_LABELS } from "@/lib/enums";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Scoring counts the work people take on themselves: a task they claimed and
 * finished is worth more than one still in their hands, but both count. Nobody
 * is scored on kiosks — those aren't claimed any more.
 */
const DONE_WEIGHT = 2;
const OPEN_WEIGHT = 1;

const VIEWS = [
  { key: "table", label: "Table" },
  { key: "bar", label: "Bar chart" },
  { key: "trend", label: "Trend" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

const DAYS = 14;

interface Row {
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

function ratingFor(score: number, best: number) {
  if (best === 0 || score === 0)
    return { label: "No activity", tone: "slate" as const };
  const share = score / best;
  if (share >= 0.8) return { label: "Excellent", tone: "green" as const };
  if (share >= 0.5) return { label: "Strong", tone: "blue" as const };
  if (share >= 0.25) return { label: "Steady", tone: "amber" as const };
  return { label: "Building up", tone: "slate" as const };
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function TeamPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireUser();
  const { view: rawView } = await searchParams;
  const view: ViewKey = (VIEWS.find((v) => v.key === rawView)?.key ??
    "table") as ViewKey;

  const since = new Date();
  since.setDate(since.getDate() - (DAYS - 1));
  since.setHours(0, 0, 0, 0);

  const [users, checklist, housekeeping] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    // Every task somebody has taken on — claimed and open, or completed.
    prisma.repairChecklistItem.findMany({
      where: { assignedToId: { not: null } },
      select: {
        assignedToId: true,
        phase: true,
        completed: true,
        completedAt: true,
      },
    }),
    prisma.housekeepingTask.findMany({
      where: { assignedToId: { not: null } },
      select: { assignedToId: true, status: true, completedAt: true },
    }),
  ]);

  const blank = () => ({
    repairDone: 0,
    qaDone: 0,
    housekeepingDone: 0,
    open: 0,
    done: 0,
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

  const rows: Row[] = users.map((u) => {
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

  const best = rows.length > 0 ? rows[0].score : 0;
  const totals = rows.reduce(
    (t, r) => ({
      done: t.done + r.done,
      open: t.open + r.open,
      repairDone: t.repairDone + r.repairDone,
      qaDone: t.qaDone + r.qaDone,
    }),
    { done: 0, open: 0, repairDone: 0, qaDone: 0 },
  );
  const active = rows.filter((r) => r.score > 0).length;

  // --- Trend: completions per day over the last two weeks -------------------
  const buckets = new Map<string, number>();
  for (let i = 0; i < DAYS; i++) {
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
  const peak = Math.max(1, ...series.map(([, n]) => n));

  const charted = rows.filter((r) => r.score > 0).slice(0, 12);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Team Performance</h1>
        <p className="text-sm text-gray-400">
          Scored on the tasks each person takes on themselves
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Tasks completed" value={totals.done} />
        <StatCard label="In progress" value={totals.open} />
        <StatCard label="Repair / QA done" value={`${totals.repairDone}/${totals.qaDone}`} />
        <StatCard
          label="Contributing"
          value={`${active}/${rows.length}`}
          hint="people with activity"
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg bg-[var(--surface)] p-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={
              v.key === "table"
                ? "/team-performance"
                : `/team-performance?view=${v.key}`
            }
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              view === v.key
                ? "bg-[var(--primary)] text-slate-900"
                : "text-gray-300 hover:bg-[var(--border)]",
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {view === "table" ? (
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
                      In progress
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((r, i) => {
                    const rating = ratingFor(r.score, best);
                    const share =
                      best > 0 ? Math.round((r.score / best) * 100) : 0;
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
                          {r.repairDone}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {r.qaDone}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {r.housekeepingDone}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-300">
                          {r.open}
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
      ) : null}

      {view === "bar" ? (
        <Card>
          <CardHeader title="Score by person" />
          <CardBody>
            {charted.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No activity to chart yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {charted.map((r) => {
                  const donePct = best > 0 ? (r.done * DONE_WEIGHT * 100) / best : 0;
                  const openPct = best > 0 ? (r.open * OPEN_WEIGHT * 100) / best : 0;
                  return (
                    <li key={r.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-gray-300">{r.name}</span>
                        <span className="text-gray-500">
                          {r.done} done · {r.open} in progress · score {r.score}
                        </span>
                      </div>
                      <div className="flex h-4 w-full overflow-hidden rounded-md bg-[var(--border)]">
                        <div
                          className="h-full bg-[var(--primary)]"
                          style={{ width: `${donePct}%` }}
                          title={`${r.done} completed`}
                        />
                        <div
                          className="h-full bg-amber-500/70"
                          style={{ width: `${openPct}%` }}
                          title={`${r.open} in progress`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[var(--primary)]" />
                Completed (×{DONE_WEIGHT})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/70" />
                In progress (×{OPEN_WEIGHT})
              </span>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {view === "trend" ? (
        <Card>
          <CardHeader title={`Tasks completed · last ${DAYS} days`} />
          <CardBody>
            <svg
              viewBox="0 0 560 180"
              className="w-full"
              role="img"
              aria-label={`Team tasks completed per day over the last ${DAYS} days, peaking at ${peak}`}
            >
              <line
                x1="0"
                y1="150"
                x2="560"
                y2="150"
                stroke="currentColor"
                className="text-gray-700"
                strokeWidth="1"
              />
              <polyline
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinejoin="round"
                points={series
                  .map(([, n], i) => {
                    const x = (i / Math.max(1, series.length - 1)) * 540 + 10;
                    const y = 150 - (n / peak) * 130;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
              {series.map(([day, n], i) => {
                const x = (i / Math.max(1, series.length - 1)) * 540 + 10;
                const y = 150 - (n / peak) * 130;
                return (
                  <g key={day}>
                    <circle cx={x} cy={y} r="3" fill="var(--primary)" />
                    {i % 3 === 0 ? (
                      <text
                        x={x}
                        y="168"
                        textAnchor="middle"
                        className="fill-gray-500"
                        fontSize="9"
                      >
                        {day.slice(5)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            <p className="mt-2 text-xs text-gray-500">
              Peak {peak} in a day · {totals.done} completed in total.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <p className="text-xs text-gray-500">
        Score counts each completed task as {DONE_WEIGHT} and each task still in
        hand as {OPEN_WEIGHT}, across repair, QA and housekeeping. Ratings are
        relative to the highest scorer, so they compare people against the floor
        rather than a fixed target.
      </p>
    </div>
  );
}
