import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { CHECKLIST_PHASE, JOB_STATUS, ROLES, stageLabel } from "@/lib/enums";
import { getStage, isQaStage, nextStage } from "@/lib/workflow";
import {
  groupChecklist,
  type ChecklistItemLike,
  type GroupedSection,
} from "@/lib/repairChecklist";
import type { SessionUser } from "@/lib/session";
import { advanceStage } from "@/app/actions/jobs";
import {
  claimTaskAction,
  releaseTaskAction,
  toggleTaskAction,
  addTaskAction,
  deleteTaskAction,
} from "@/app/actions/checklist";
import {
  requestPartAction,
  cancelPartRequestAction,
  fulfilPartRequestAction,
} from "@/app/actions/partRequests";
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
      kiosk: true,
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
      repairChecklist: {
        orderBy: { sequence: "asc" },
        include: { assignedTo: true },
      },
      partRequests: {
        orderBy: { createdAt: "asc" },
        include: { requestedBy: true, part: true },
      },
    },
  });

  if (!job) notFound();

  const next = nextStage(job.kind, job.currentStage);
  const completed = job.status === JOB_STATUS.COMPLETED;
  const atQa = isQaStage(job.kind, job.currentStage);
  const atRepair = job.currentStage === "REPAIR";

  const repairItems = job.repairChecklist.filter(
    (i) => i.phase === CHECKLIST_PHASE.REPAIR,
  );
  const qaItems = job.repairChecklist.filter(
    (i) => i.phase === CHECKLIST_PHASE.QA,
  );
  const hasChecklist = repairItems.length > 0;
  const repairComplete = repairItems.every((i) => i.completed);
  const doneCount = repairItems.filter((i) => i.completed).length;
  const qaDoneCount = qaItems.filter((i) => i.completed).length;
  const qaComplete = qaItems.every((i) => i.completed);

  // Task-level assignment is open to the whole floor.
  const canAddTask = true;
  const canDeleteTask =
    user.role === ROLES.TEAM_LEADER || user.role === ROLES.PRODUCTION_MANAGER;
  const sections = groupChecklist(
    repairItems as unknown as ChecklistItemLike[],
  );
  const qaSections = groupChecklist(qaItems as unknown as ChecklistItemLike[]);

  // Each checklist only shows while it's the unit's business: the repair one
  // disappears once the unit moves past Repair, and the QA one doesn't appear
  // until it reaches QA. Comparing sequence (not stage name) keeps this right
  // for builds, whose pipeline has different early stages.
  const stageSeq = getStage(job.kind, job.currentStage)?.sequence ?? 0;
  const repairSeq = getStage(job.kind, "REPAIR")?.sequence ?? Infinity;
  const qaSeq = getStage(job.kind, "QA")?.sequence ?? Infinity;
  const showRepairCard = repairItems.length > 0 && stageSeq <= repairSeq;
  const showQaCard = qaItems.length > 0 && stageSeq >= qaSeq;

  const canIssue = can(user.role, "inventory:move") && !completed;
  // The catalogue also backs the request box's autocomplete, so everyone who
  // can see the unit needs it — not just inventory staff.
  const catalogue = await prisma.part.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true, quantityOnHand: true },
  });
  const availableParts = canIssue
    ? catalogue.filter((p) => p.quantityOnHand > 0)
    : [];

  const canRequestParts = !completed;
  const openRequests = job.partRequests.filter(
    (r) => r.status === "NEEDED",
  );
  const canManageRequests =
    user.role === ROLES.TEAM_LEADER || user.role === ROLES.PRODUCTION_MANAGER;
  const partsCost = job.stockMovements.reduce(
    (sum, m) => sum + m.quantity * m.part.unitCost,
    0,
  );

  // Mirrors canModifyJob() in src/app/actions/jobs.ts — keep the two in step.
  const canModify = can(user.role, "job:advanceStage");

  const showAdvance =
    can(user.role, "job:advanceStage") &&
    canModify &&
    !completed &&
    !!next &&
    !atQa &&
    (!atRepair || repairComplete);
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
            {job.kiosk.group} · current stage:{" "}
            <span className="font-medium text-slate-700">
              {stageLabel(job.kind, job.currentStage)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showAdvance && next ? (
            <form action={advanceStage}>
              <input type="hidden" name="jobId" value={job.id} />
              <Button type="submit">
                Advance to {stageLabel(job.kind, next.name)}
                {next.isTerminal ? " (complete)" : ""}
              </Button>
            </form>
          ) : null}
          {atRepair && hasChecklist && !repairComplete && !completed ? (
            <span className="text-sm text-slate-500">
              {doneCount}/{repairItems.length} repair tasks complete — finish
              them all to advance
            </span>
          ) : null}
          {atQa && !qaComplete && !completed ? (
            <span className="text-sm text-slate-500">
              {qaDoneCount}/{qaItems.length} QA checks complete — finish them
              all to pass
            </span>
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

      {showRepairCard ? (
        <ChecklistCard
          title="Repair Workflow"
          jobId={job.id}
          phase={CHECKLIST_PHASE.REPAIR}
          sections={sections}
          done={doneCount}
          total={repairItems.length}
          user={user}
          canAddTask={canAddTask}
          canDeleteTask={canDeleteTask}
        />
      ) : null}

      {showQaCard ? (
        <ChecklistCard
          title="Quality"
          jobId={job.id}
          phase={CHECKLIST_PHASE.QA}
          sections={qaSections}
          done={qaDoneCount}
          total={qaItems.length}
          user={user}
          canAddTask={canAddTask}
          canDeleteTask={canDeleteTask}
        />
      ) : null}

      <Card>
        <CardHeader title="Parts" />
        <CardBody>
          <div className="rounded-md border border-[var(--border)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="text-sm font-semibold text-white">
                Required Stock
              </span>
              <span className="text-xs text-gray-400">
                {openRequests.length} item
                {openRequests.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-1 p-3">
              {job.partRequests.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  No stock items added yet
                </p>
              ) : (
                job.partRequests.map((req) => {
                  const pending = req.status === "NEEDED";
                  const mine = req.requestedById === user.id;
                  return (
                    <div
                      key={req.id}
                      className="flex items-center gap-2 py-1.5 text-sm"
                    >
                      <span className="w-10 shrink-0 font-mono text-gray-400">
                        ×{req.quantity}
                      </span>
                      <span
                        className={
                          req.status === "CANCELLED"
                            ? "flex-1 text-gray-600 line-through"
                            : "flex-1 text-gray-200"
                        }
                      >
                        {req.description}
                        {req.part ? (
                          <span className="ml-2 text-xs text-gray-500">
                            {req.part.sku} · {req.part.quantityOnHand} in stock
                          </span>
                        ) : (
                          <span className="ml-2 text-xs text-amber-500">
                            not in catalogue
                          </span>
                        )}
                      </span>
                      <Badge
                        tone={
                          req.status === "ISSUED"
                            ? "green"
                            : req.status === "CANCELLED"
                              ? "slate"
                              : "amber"
                        }
                      >
                        {req.status.toLowerCase()}
                      </Badge>
                      <span className="hidden w-28 shrink-0 truncate text-xs text-gray-500 sm:block">
                        {req.requestedBy.name}
                      </span>
                      {pending && canIssue && req.part ? (
                        <form action={fulfilPartRequestAction}>
                          <input
                            type="hidden"
                            name="requestId"
                            value={req.id}
                          />
                          <button
                            type="submit"
                            className="rounded-md bg-[var(--primary)] px-3 py-1 text-xs font-medium text-slate-900 hover:opacity-90"
                          >
                            Issue
                          </button>
                        </form>
                      ) : null}
                      {pending && (mine || canManageRequests) ? (
                        <form action={cancelPartRequestAction}>
                          <input
                            type="hidden"
                            name="requestId"
                            value={req.id}
                          />
                          <button
                            type="submit"
                            title="Cancel request"
                            className="text-gray-600 hover:text-red-400"
                          >
                            ×
                          </button>
                        </form>
                      ) : null}
                    </div>
                  );
                })
              )}

              {canRequestParts ? (
                <form
                  action={requestPartAction}
                  className="flex items-center gap-2 pt-2"
                >
                  <input type="hidden" name="jobId" value={job.id} />
                  <input
                    type="text"
                    name="description"
                    list="parts-catalogue"
                    placeholder="Part / stock item…"
                    required
                    className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                  <datalist id="parts-catalogue">
                    {catalogue.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.sku} · {p.quantityOnHand} in stock
                      </option>
                    ))}
                  </datalist>
                  <input
                    type="number"
                    name="quantity"
                    min="1"
                    defaultValue={1}
                    className="w-16 rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-center text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                  <button
                    type="submit"
                    aria-label="Request part"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-gray-300 hover:bg-[var(--border)]"
                  >
                    +
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Details" />
          <CardBody className="space-y-3 text-sm">
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

function countTotal(section: GroupedSection): number {
  return (
    section.directItems.length +
    section.subsections.reduce((sum, s) => sum + s.items.length, 0)
  );
}

function countDone(section: GroupedSection): number {
  const direct = section.directItems.filter((i) => i.completed).length;
  const nested = section.subsections.reduce(
    (sum, s) => sum + s.items.filter((i) => i.completed).length,
    0,
  );
  return direct + nested;
}

/** A whole checklist (Repair or QA): collapsible sections of claimable tasks. */
function ChecklistCard({
  title,
  jobId,
  phase,
  sections,
  done,
  total,
  user,
  canAddTask,
  canDeleteTask,
}: {
  title: string;
  jobId: string;
  phase: string;
  sections: GroupedSection[];
  done: number;
  total: number;
  user: SessionUser;
  canAddTask: boolean;
  canDeleteTask: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <span className="text-xs text-gray-400">
            {done}/{total}
          </span>
        }
      />
      <CardBody className="space-y-4">
        {sections.map((section) => (
          <details
            key={section.name}
            open
            className="rounded-md border border-[var(--border)]"
          >
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-semibold text-white">
              {section.name}
              <span className="text-xs font-normal text-gray-400">
                {countDone(section)}/{countTotal(section)}
              </span>
            </summary>
            <div className="space-y-3 border-t border-[var(--border)] p-3">
              {section.directItems.length > 0 ? (
                <TaskList
                  jobId={jobId}
                  phase={phase}
                  section={section.name}
                  subsection={null}
                  items={section.directItems}
                  user={user}
                  canAddTask={canAddTask}
                  canDeleteTask={canDeleteTask}
                />
              ) : null}
              {section.subsections.map((sub) => (
                <div key={sub.name}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {sub.name}
                    <span className="ml-2 font-normal normal-case text-gray-600">
                      {sub.items.filter((i) => i.completed).length}/
                      {sub.items.length}
                    </span>
                  </p>
                  <TaskList
                    jobId={jobId}
                    phase={phase}
                    section={section.name}
                    subsection={sub.name}
                    items={sub.items}
                    user={user}
                    canAddTask={canAddTask}
                    canDeleteTask={canDeleteTask}
                  />
                </div>
              ))}
            </div>
          </details>
        ))}
      </CardBody>
    </Card>
  );
}

/** One section/subsection's task rows, plus the "add task" input beneath them. */
function TaskList({
  jobId,
  phase,
  section,
  subsection,
  items,
  user,
  canAddTask,
  canDeleteTask,
}: {
  jobId: string;
  phase: string;
  section: string;
  subsection: string | null;
  items: ChecklistItemLike[];
  user: SessionUser;
  canAddTask: boolean;
  canDeleteTask: boolean;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <TaskRow
          key={item.id}
          item={item}
          user={user}
          canDeleteTask={canDeleteTask}
        />
      ))}
      {canAddTask ? (
        <form action={addTaskAction} className="flex items-center gap-2 pt-1">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="phase" value={phase} />
          <input type="hidden" name="section" value={section} />
          {subsection ? (
            <input type="hidden" name="subsection" value={subsection} />
          ) : null}
          <input
            type="text"
            name="title"
            placeholder={subsection ? "Add task…" : "Add check…"}
            className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-gray-300 hover:bg-[var(--border)]"
            aria-label="Add task"
          >
            +
          </button>
        </form>
      ) : null}
    </div>
  );
}

function TaskRow({
  item,
  user,
  canDeleteTask,
}: {
  item: ChecklistItemLike;
  user: SessionUser;
  canDeleteTask: boolean;
}) {
  const isMine = item.assignedToId === user.id;
  const isManager =
    user.role === ROLES.PRODUCTION_MANAGER || user.role === ROLES.TEAM_LEADER;
  // Anyone may pick up an unclaimed task or tick it off; only the holder (or a
  // manager) can touch one somebody else has taken.
  const canToggle = isMine || isManager || !item.assignedToId;
  const canClaim = true;

  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      {canToggle ? (
        <form action={toggleTaskAction}>
          <input type="hidden" name="itemId" value={item.id} />
          <button
            type="submit"
            aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
            className={`flex h-4 w-4 items-center justify-center rounded-full border ${
              item.completed
                ? "border-[var(--primary)] bg-[var(--primary)] text-slate-900"
                : "border-gray-500"
            }`}
          >
            {item.completed ? "✓" : ""}
          </button>
        </form>
      ) : (
        <span
          title={
            item.assignedToId
              ? "Assigned to someone else"
              : "Assign yourself first"
          }
          className={`flex h-4 w-4 items-center justify-center rounded-full border ${
            item.completed
              ? "border-[var(--primary)] bg-[var(--primary)] text-slate-900"
              : "border-gray-600"
          }`}
        >
          {item.completed ? "✓" : ""}
        </span>
      )}

      <span
        className={`flex-1 ${item.completed ? "text-gray-500 line-through" : "text-gray-200"}`}
      >
        {item.title}
      </span>

      {item.assignedToId && !isMine ? (
        <span
          title={item.assignedTo?.name ?? "Assigned"}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--border)] text-[10px] font-semibold text-gray-300"
        >
          {(item.assignedTo?.name ?? "?").charAt(0).toUpperCase()}
        </span>
      ) : isMine ? (
        <form action={releaseTaskAction}>
          <input type="hidden" name="itemId" value={item.id} />
          <button
            type="submit"
            title="Release this task"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-semibold text-slate-900"
          >
            {user.name.charAt(0).toUpperCase()}
          </button>
        </form>
      ) : canClaim ? (
        <form action={claimTaskAction}>
          <input type="hidden" name="itemId" value={item.id} />
          <button
            type="submit"
            title="Assign yourself"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-600 text-gray-400 hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            +
          </button>
        </form>
      ) : (
        <span className="h-6 w-6" />
      )}

      {canDeleteTask ? (
        <form action={deleteTaskAction}>
          <input type="hidden" name="itemId" value={item.id} />
          <button
            type="submit"
            title="Delete task"
            className="text-gray-600 hover:text-red-400"
          >
            ×
          </button>
        </form>
      ) : null}
    </div>
  );
}
