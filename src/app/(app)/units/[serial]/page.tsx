import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { JOB_STATUS, ROLES, stageLabel } from "@/lib/enums";
import { isQaStage, nextStage } from "@/lib/workflow";
import { advanceStage } from "@/app/actions/jobs";
import { claimJob, releaseJob } from "@/app/actions/assignment";
import { IssuePartForm } from "@/components/issue-part-form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { KindBadge, StatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/utils";

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial: raw } = await params;
  const serial = decodeURIComponent(raw);
  const user = await requireUser();

  const job = await prisma.job.findFirst({
    where: { kiosk: { serialNumber: serial } },
    orderBy: { createdAt: "desc" },
    include: {
      kiosk: { include: { model: true } },
      assignedTeam: true,
      assignedTech: true,
      transitions: { orderBy: { enteredAt: "asc" }, include: { user: true } },
      inspections: {
        orderBy: { createdAt: "asc" },
        include: {
          inspector: true,
          defects: { include: { defectType: true } },
        },
      },
      stockMovements: {
        where: { type: "ISSUE" },
        orderBy: { createdAt: "asc" },
        include: { part: true },
      },
    },
  });

  if (!job) notFound();

  const next = nextStage(job.kind, job.currentStage);
  const completed = job.status === JOB_STATUS.COMPLETED;
  const atQa = isQaStage(job.kind, job.currentStage);

  const canIssue = can(user.role, "inventory:move") && !completed;
  const availableParts = canIssue
    ? await prisma.part.findMany({
        where: { quantityOnHand: { gt: 0 } },
        orderBy: { name: "asc" },
      })
    : [];
  const partsCost = job.stockMovements.reduce(
    (sum, m) => sum + m.quantity * m.part.unitCost,
    0,
  );

  const isTechnician =
    user.role === ROLES.REPAIR_TECHNICIAN || user.role === ROLES.QA_TECHNICIAN;
  const canModify =
    user.role === ROLES.PRODUCTION_MANAGER ||
    (user.role === ROLES.TEAM_LEADER &&
      !!user.teamId &&
      job.assignedTeamId === user.teamId) ||
    (isTechnician && job.assignedTechId === user.id);

  // Technicians claim unclaimed work at any stage, and can hand it back.
  const showClaim = isTechnician && !completed && !job.assignedTechId;
  const showRelease =
    isTechnician && !completed && job.assignedTechId === user.id;
  const showAdvance =
    can(user.role, "job:advanceStage") &&
    canModify &&
    !completed &&
    !!next &&
    !atQa;
  const showInspect = can(user.role, "qa:inspect") && !completed && atQa;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-xl font-semibold text-slate-900">
            {job.kiosk.serialNumber}
            <KindBadge kind={job.kind} />
            <StatusBadge status={job.status} />
          </h1>
          <p className="text-sm text-slate-500">
            {job.kiosk.model.name} · current stage:{" "}
            <span className="font-medium text-slate-700">
              {stageLabel(job.kind, job.currentStage)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showClaim ? (
            <form action={claimJob}>
              <input type="hidden" name="jobId" value={job.id} />
              <Button type="submit">Claim this unit</Button>
            </form>
          ) : null}
          {showRelease ? (
            <form action={releaseJob}>
              <input type="hidden" name="jobId" value={job.id} />
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm text-gray-300 hover:bg-[var(--border)]"
              >
                Release
              </button>
            </form>
          ) : null}
          {showAdvance && next ? (
            <form action={advanceStage}>
              <input type="hidden" name="jobId" value={job.id} />
              <Button type="submit">
                Advance to {stageLabel(job.kind, next.name)}
                {next.isTerminal ? " (complete)" : ""}
              </Button>
            </form>
          ) : null}
          {showInspect ? (
            <Link
              href={`/qa/${encodeURIComponent(job.kiosk.serialNumber)}`}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Inspect (QA)
            </Link>
          ) : null}
          {atQa && !showInspect && !completed ? (
            <span className="text-sm text-slate-500">Awaiting QA</span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Details" />
          <CardBody className="space-y-3 text-sm">
            <Detail label="Team" value={job.assignedTeam?.name ?? "—"} />
            <Detail label="Technician" value={job.assignedTech?.name ?? "—"} />
            <Detail
              label="Priority"
              value={<Badge>{job.priority.toLowerCase()}</Badge>}
            />
            {job.kind === "BUILD" ? (
              <Detail label="Build order" value={job.buildOrderRef ?? "—"} />
            ) : (
              <Detail label="Fault report" value={job.faultReport ?? "—"} />
            )}
            <Detail label="Created" value={formatDateTime(job.createdAt)} />
            <Detail
              label="Completed"
              value={job.completedAt ? formatDateTime(job.completedAt) : "—"}
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Stage timeline" />
          <CardBody className="p-0">
            <ol className="divide-y divide-slate-100">
              {job.transitions.map((t) => {
                const end = t.exitedAt ?? undefined;
                const duration = formatDuration(
                  t.enteredAt.getTime(),
                  (t.exitedAt ?? new Date()).getTime(),
                );
                return (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                    <span
                      className={`mt-1 h-2 w-2 rounded-full ${
                        end ? "bg-slate-300" : "bg-blue-500"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">
                          {stageLabel(job.kind, t.stage)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {duration}
                          {end ? "" : " (ongoing)"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Entered {formatDateTime(t.enteredAt)}
                        {t.user ? ` · ${t.user.name}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>
      </div>

      {job.stockMovements.length > 0 || canIssue ? (
        <Card>
          <CardHeader
            title="Parts used"
            action={
              partsCost > 0 ? (
                <span className="text-sm font-medium text-slate-700">
                  {formatMoney(partsCost)}
                </span>
              ) : null
            }
          />
          <CardBody className="space-y-4">
            {job.stockMovements.length > 0 ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {job.stockMovements.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-slate-700">
                      {m.quantity} × {m.part.name}
                      <span className="ml-2 text-xs text-slate-400">
                        {m.part.sku}
                      </span>
                    </span>
                    <span className="text-slate-500">
                      {formatMoney(m.quantity * m.part.unitCost)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No parts issued yet.</p>
            )}
            {canIssue ? (
              <div className="border-t border-slate-100 pt-4">
                <IssuePartForm
                  jobId={job.id}
                  parts={availableParts.map((p) => ({
                    id: p.id,
                    label: `${p.name} (${p.quantityOnHand} in stock)`,
                  }))}
                />
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {job.inspections.length > 0 ? (
        <Card>
          <CardHeader title="QA inspections" />
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {job.inspections.map((ins) => (
                <li key={ins.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge tone={ins.result === "PASS" ? "green" : "red"}>
                      {ins.result === "PASS" ? "Pass" : "Fail"}
                    </Badge>
                    <span className="text-slate-500">
                      {ins.inspector.name} · {formatDateTime(ins.createdAt)}
                    </span>
                  </div>
                  {ins.defects.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ins.defects.map((d) => (
                        <Badge key={d.id} tone="amber">
                          {d.defectType.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {ins.notes ? (
                    <p className="mt-1 text-xs text-slate-500">{ins.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-800">{value}</span>
    </div>
  );
}
