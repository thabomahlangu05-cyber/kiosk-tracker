import { requireAction } from "@/lib/auth";
import { teamPerformance } from "@/lib/metrics";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/card";

function getDateRange(days: number) {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export default async function TeamPerformancePage() {
  await requireAction("reports:view");

  const { from, to } = getDateRange(7);
  const perf = await teamPerformance(from, to);

  const totalCompleted = perf.reduce((sum, t) => sum + t.completed, 0);
  const avgPassRate = perf.length > 0
    ? Math.round(
        perf.reduce((sum, t) => sum + (t.passRate || 0), 0) / perf.filter((t) => t.passRate !== null).length,
      )
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Team Performance</h1>
        <p className="text-sm text-gray-400">Last 7 days — units completed, turnaround, quality</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total completed" value={totalCompleted} />
        <StatCard label="Team members" value={perf.length} />
        <StatCard label="Avg pass rate" value={avgPassRate ? `${avgPassRate}%` : "—"} />
        <StatCard label="Period" value="7 days" />
      </div>

      <Card>
        <CardHeader title="Technician leaderboard" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--border)] text-left text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">Technician</th>
                <th className="px-4 py-2 font-medium">Team</th>
                <th className="px-4 py-2 font-medium text-right">Completed</th>
                <th className="px-4 py-2 font-medium text-right">Avg hours</th>
                <th className="px-4 py-2 font-medium text-right">Pass rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {perf.map((t) => (
                <tr key={t.techId} className="hover:bg-[var(--border)]">
                  <td className="px-4 py-3 font-medium text-white">{t.techName}</td>
                  <td className="px-4 py-3 text-gray-400">{t.teamName || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">{t.completed}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{t.avgTurnaroundHours.toFixed(1)} h</td>
                  <td className="px-4 py-3 text-right">
                    {t.passRate !== null ? (
                      <span className={t.passRate >= 80 ? "text-green-400" : t.passRate >= 60 ? "text-yellow-400" : "text-red-400"}>
                        {t.passRate}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {perf.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">No data for this period.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
