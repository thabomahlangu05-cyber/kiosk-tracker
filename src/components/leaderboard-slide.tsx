import type { PerformanceRow } from "@/lib/performance";
import { ROLE_LABELS } from "@/lib/enums";

/**
 * The Team Performance standings rendered for a full-screen slide — large type,
 * no chrome, readable from across the floor.
 */
export function LeaderboardSlide({
  rows,
  best,
  totals,
}: {
  rows: PerformanceRow[];
  best: number;
  totals: { done: number; open: number };
}) {
  const top = rows.filter((r) => r.score > 0).slice(0, 8);

  return (
    <div className="flex h-full w-full flex-col justify-center bg-[var(--bg)] px-10 py-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-[var(--primary)]">
          Team Performance
        </p>
        <h2 className="text-3xl font-semibold text-white">
          {totals.done} tasks completed
          <span className="ml-3 text-lg font-normal text-gray-400">
            {totals.open} in progress
          </span>
        </h2>
      </div>

      {top.length === 0 ? (
        <p className="text-lg text-gray-500">No activity yet today.</p>
      ) : (
        <ol className="space-y-3">
          {top.map((r, i) => (
            <li key={r.id} className="flex items-center gap-4">
              <span className="w-8 text-2xl font-bold text-gray-600">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="truncate text-xl font-medium text-white">
                    {r.name}
                  </span>
                  <span className="shrink-0 text-sm text-gray-500">
                    {ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{
                        width: `${best > 0 ? (r.score / best) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-sm text-gray-400">
                    {r.done} done · {r.score}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
