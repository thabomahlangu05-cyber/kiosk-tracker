import Link from "next/link";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JOB_STATUS } from "@/lib/enums";
import { firstPassYield, defectBreakdown } from "@/lib/metrics";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui/card";
import { KindBadge, Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export default async function QaPage() {
  await requireAction("qa:inspect");

  const [awaiting, fpy, defects, recent] = await Promise.all([
    prisma.job.findMany({
      where: { status: JOB_STATUS.IN_PROGRESS, currentStage: "QA" },
      orderBy: { createdAt: "asc" },
      include: { kiosk: { include: { model: true } }, assignedTeam: true },
    }),
    firstPassYield(),
    defectBreakdown(),
    prisma.qAInspection.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        inspector: true,
        job: { include: { kiosk: true } },
        defects: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">
          Quality Assurance
        </h1>
        <p className="text-sm text-gray-400">
          Inspect units at the QA stage and track first-pass yield
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Awaiting QA" value={awaiting.length} />
        <StatCard
          label="First-pass yield"
          value={fpy.yieldPct === null ? "—" : `${fpy.yieldPct}%`}
          hint={`${fpy.firstPassJobs}/${fpy.inspectedJobs} units`}
        />
        <StatCard label="Inspections" value={fpy.totalInspections} />
        <StatCard label="Failures / rework" value={fpy.failCount} />
      </div>

      <Card>
        <CardHeader title="Awaiting inspection" />
        <CardBody className="p-0">
          <ul className="divide-y divide-[var(--border)]">
            {awaiting.map((job) => (
              <li
                key={job.id}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-[var(--border)]"
              >
                <span className="flex items-center gap-3">
                  <span className="font-medium text-white">
                    {job.kiosk.serialNumber}
                  </span>
                  <KindBadge kind={job.kind} />
                  <span className="text-gray-500">{job.kiosk.model.name}</span>
                </span>
                <Link
                  href={`/qa/${encodeURIComponent(job.kiosk.serialNumber)}`}
                  className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-[var(--primary-dark)]"
                >
                  Inspect
                </Link>
              </li>
            ))}
            {awaiting.length === 0 ? (
              <li className="px-4 py-6 text-center text-gray-500">
                No units waiting for QA.
              </li>
            ) : null}
          </ul>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent inspections" />
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {recent.map((ins) => (
                <li
                  key={ins.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span>
                    <Link
                      href={`/units/${encodeURIComponent(ins.job.kiosk.serialNumber)}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {ins.job.kiosk.serialNumber}
                    </Link>
                    <span className="ml-2 text-slate-400">
                      {ins.inspector.name} · {formatDateTime(ins.createdAt)}
                    </span>
                  </span>
                  <Badge tone={ins.result === "PASS" ? "green" : "red"}>
                    {ins.result === "PASS"
                      ? "Pass"
                      : `Fail (${ins.defects.length})`}
                  </Badge>
                </li>
              ))}
              {recent.length === 0 ? (
                <li className="px-4 py-6 text-center text-slate-400">
                  No inspections yet.
                </li>
              ) : null}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top defects" />
          <CardBody>
            {defects.length === 0 ? (
              <p className="text-sm text-slate-400">No defects logged.</p>
            ) : (
              <ul className="space-y-2">
                {defects.map((d) => (
                  <li
                    key={d.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-700">{d.name}</span>
                    <span className="font-medium text-slate-900">{d.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
