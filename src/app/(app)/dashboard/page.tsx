import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { JOB_STATUS, ROLES, stageLabel } from "@/lib/enums";
import { firstPassYield } from "@/lib/metrics";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui/card";
import { KindBadge, StatusBadge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const user = await requireUser();

  const [active, inQa, completed, parts, wip, recent, myQueue, fpy] =
    await Promise.all([
      prisma.job.count({ where: { status: JOB_STATUS.IN_PROGRESS } }),
      prisma.job.count({
        where: { status: JOB_STATUS.IN_PROGRESS, currentStage: "QA" },
      }),
      prisma.job.count({ where: { status: JOB_STATUS.COMPLETED } }),
      prisma.part.findMany({
        select: { name: true, quantityOnHand: true, reorderLevel: true },
      }),
      prisma.job.groupBy({
        by: ["currentStage", "kind"],
        where: { status: JOB_STATUS.IN_PROGRESS },
        _count: { _all: true },
      }),
      prisma.job.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { kiosk: { include: { model: true } }, assignedTech: true },
      }),
      user.role === ROLES.REPAIR_TECHNICIAN
        ? prisma.job.count({
            where: {
              assignedTechId: user.id,
              status: JOB_STATUS.IN_PROGRESS,
            },
          })
        : Promise.resolve(0),
      firstPassYield(),
    ]);

  const lowStock = parts.filter((p) => p.quantityOnHand <= p.reorderLevel);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-gray-400">Production overview</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Active units" value={active} />
        <StatCard label="In QA" value={inQa} />
        <StatCard
          label="First-pass yield"
          value={fpy.yieldPct === null ? "—" : `${fpy.yieldPct}%`}
        />
        <StatCard label="Completed" value={completed} />
        {user.role === ROLES.REPAIR_TECHNICIAN ? (
          <StatCard label="My queue" value={myQueue} hint="assigned to you" />
        ) : (
          <StatCard
            label="Low stock parts"
            value={lowStock.length}
            hint={can(user.role, "inventory:view") ? "at/below reorder" : undefined}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Work in progress by stage" />
          <CardBody>
            {wip.length === 0 ? (
              <p className="text-sm text-gray-500">No active units.</p>
            ) : (
              <ul className="space-y-2">
                {wip.map((w) => (
                  <li
                    key={`${w.kind}-${w.currentStage}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <KindBadge kind={w.kind} />
                      <span className="text-gray-300">
                        {stageLabel(w.kind, w.currentStage)}
                      </span>
                    </span>
                    <span className="font-medium text-white">
                      {w._count._all}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent units"
            action={
              <Link
                href="/units"
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                View all
              </Link>
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {recent.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/units/${encodeURIComponent(job.kiosk.serialNumber)}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-[var(--border)]"
                  >
                    <span>
                      <span className="font-medium text-white">
                        {job.kiosk.serialNumber}
                      </span>
                      <span className="ml-2 text-gray-500">
                        {job.kiosk.model.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <KindBadge kind={job.kind} />
                      <StatusBadge status={job.status} />
                    </span>
                  </Link>
                </li>
              ))}
              {recent.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-slate-400">
                  No units yet — start with Intake.
                </li>
              ) : null}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
