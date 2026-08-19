"use server";

import { requireUser } from "@/lib/auth";
import { getPerformance, type PerformanceRow } from "@/lib/performance";

export interface LeaderboardSnapshot {
  rows: PerformanceRow[];
  best: number;
  totals: { done: number; open: number };
}

/**
 * Standings for the sleep-mode slide, fetched only once the screen actually
 * sleeps. Running this in the layout instead made every page load pay for
 * three table scans, which exhausted the single-connection pool.
 */
export async function getLeaderboardSnapshot(): Promise<LeaderboardSnapshot> {
  await requireUser();
  const perf = await getPerformance();
  return {
    rows: perf.rows.filter((r) => r.score > 0).slice(0, 8),
    best: perf.best,
    totals: { done: perf.totals.done, open: perf.totals.open },
  };
}
