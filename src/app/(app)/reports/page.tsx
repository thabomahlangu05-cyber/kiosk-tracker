import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  firstPassYield,
  partsConsumption,
  throughput,
  turnaround,
} from "@/lib/metrics";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatHours, formatMoney } from "@/lib/utils";

interface DateRange {
  from: Date;
  to: Date;
}

function getDateRange(days: number): DateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireAction("reports:view");
  const { range: rawRange } = await searchParams;
  const days = rawRange === "7" ? 7 : rawRange === "30" ? 30 : 1;
  const { from, to } = getDateRange(days);

  const [tp, tar, fpy, parts] = await Promise.all([
    throughput(from, to),
    turnaround(from, to),
    firstPassYield(),
    partsConsumption(),
  ]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Reports</h1>
        <p className="text-sm text-gray-400">
          Production metrics for {formatDate(from)} to {formatDate(to)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: "Today", v: "1" },
          { label: "Last 7 days", v: "7" },
          { label: "Last 30 days", v: "30" },
        ].map((opt) => (
          <a
            key={opt.v}
            href={`?range=${opt.v}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              String(days) === opt.v
                ? "bg-[var(--primary)] text-slate-900"
                : "border border-[var(--border)] text-gray-400 hover:bg-[var(--border)] hover:text-white"
            }`}
          >
            {opt.label}
          </a>
        ))}
        <a
          href={`/api/reports/export?range=${days}`}
          className="ml-auto rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-[var(--primary-dark)]"
        >
          Download CSV
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Units completed" value={tp.total} />
        <StatCard
          label="Avg end-to-end"
          value={
            tar.avgEndToEndMs ? formatHours(tar.avgEndToEndMs) : "—"
          }
        />
        <StatCard
          label="First-pass yield"
          value={fpy.yieldPct === null ? "—" : `${fpy.yieldPct}%`}
        />
        <StatCard label="Parts consumed" value={formatMoney(parts.consumptionCost)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Throughput by team" />
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {tp.byTeam.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-2 text-slate-700">{row.label}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {row.count} units
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tp.byTeam.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                No completed units in this period.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Avg turnaround by stage" />
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {tar.perStage.slice(0, 8).map((row) => (
                  <tr key={`${row.kind}-${row.stage}`}>
                    <td className="px-4 py-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {row.kind}
                      </span>
                      <span className="ml-2 text-slate-600">{row.stage}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {formatHours(row.avgMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tar.perStage.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                No stage data.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Throughput by technician" />
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100 text-sm">
              {tp.byTech.slice(0, 10).map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-medium text-slate-900">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Quality metrics" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Inspected units" value={fpy.inspectedJobs} />
            <Row label="First-pass" value={fpy.firstPassJobs} />
            <Row label="Rework / failures" value={fpy.failCount} />
            <Row label="Total inspections" value={fpy.totalInspections} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Inventory" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Parts in catalog" value={parts.totalParts} />
            <Row label="Low stock items" value={parts.lowStock.length} />
            <Row label="Stock value" value={formatMoney(parts.stockValue)} />
            <Row label="Total consumption" value={formatMoney(parts.consumptionCost)} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
