import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getAllTasks,
  createTaskAction,
  claimTaskAction,
  releaseTaskAction,
  completeTaskAction,
  reopenTaskAction,
  deleteTaskAction,
} from "@/app/actions/housekeeping";
import {
  FIVE_S,
  FIVE_S_LABELS,
  HOUSEKEEPING_CATEGORIES,
  HOUSEKEEPING_FREQUENCIES,
  PRIORITIES,
  ROLES,
  titleCase,
} from "@/lib/enums";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";

const CATEGORY_TONES: Record<string, "green" | "blue" | "violet" | "red" | "slate"> = {
  CLEANING: "green",
  TOOLS: "blue",
  STOCK: "violet",
  SAFETY: "red",
  GENERAL: "slate",
};

const PRIORITY_TONES: Record<string, "slate" | "blue" | "amber" | "red"> = {
  LOW: "slate",
  NORMAL: "blue",
  HIGH: "amber",
  URGENT: "red",
};

export default async function HousekeepingPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await requireUser();
  const { category: rawCategory } = await searchParams;
  const activeCategory =
    rawCategory &&
    HOUSEKEEPING_CATEGORIES.includes(
      rawCategory as (typeof HOUSEKEEPING_CATEGORIES)[number],
    )
      ? rawCategory
      : "all";

  const tasks = await getAllTasks();
  const visible =
    activeCategory === "all"
      ? tasks
      : tasks.filter((t) => t.category === activeCategory);

  const pending = visible.filter((t) => t.status !== "COMPLETED");
  const completed = visible.filter((t) => t.status === "COMPLETED");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const completedToday = tasks.filter(
    (t) => t.completedAt && t.completedAt >= startOfToday,
  ).length;

  const isManager =
    user.role === ROLES.PRODUCTION_MANAGER || user.role === ROLES.TEAM_LEADER;

  const tabs = [
    { key: "all", label: "All", count: tasks.length },
    ...HOUSEKEEPING_CATEGORIES.map((c) => ({
      key: c,
      label: titleCase(c),
      count: tasks.filter((t) => t.category === c).length,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Housekeeping</h1>
        <p className="text-sm text-gray-400">
          {tasks.filter((t) => t.status !== "COMPLETED").length} pending ·{" "}
          {completedToday} completed today
        </p>
      </div>

      <Card>
        <CardHeader title="Add a task" />
        <CardBody>
          <form
            action={createTaskAction}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-56 flex-1">
              <label
                htmlFor="hk-title"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Task
              </label>
              <input
                id="hk-title"
                name="title"
                required
                placeholder="What needs doing?"
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
            <div className="min-w-40">
              <label
                htmlFor="hk-area"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Area
              </label>
              <input
                id="hk-area"
                name="area"
                placeholder="Dispatch bay…"
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
            <div>
              <label
                htmlFor="hk-fives"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                5S standard
              </label>
              <select
                id="hk-fives"
                name="fiveS"
                defaultValue=""
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              >
                <option value="">None</option>
                {FIVE_S.map((s) => (
                  <option key={s} value={s}>
                    {FIVE_S_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="hk-category"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Category
              </label>
              <select
                id="hk-category"
                name="category"
                defaultValue="GENERAL"
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              >
                {HOUSEKEEPING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {titleCase(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="hk-frequency"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Frequency
              </label>
              <select
                id="hk-frequency"
                name="frequency"
                defaultValue="ONCE"
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              >
                {HOUSEKEEPING_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {titleCase(f)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="hk-priority"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Priority
              </label>
              <select
                id="hk-priority"
                name="priority"
                defaultValue={PRIORITIES.NORMAL}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              >
                {Object.values(PRIORITIES).map((p) => (
                  <option key={p} value={p}>
                    {titleCase(p)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-slate-900 hover:bg-[var(--primary-dark)]"
            >
              + Add Task
            </button>
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-wrap gap-2 rounded-lg bg-[var(--surface)] p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={
              tab.key === "all"
                ? "/housekeeping"
                : `/housekeeping?category=${tab.key}`
            }
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeCategory === tab.key
                ? "bg-[var(--primary)] text-slate-900"
                : "text-gray-300 hover:bg-[var(--border)]",
            )}
          >
            {tab.label} ({tab.count})
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title={`Pending (${pending.length})`} />
        <CardBody className="p-0">
          {pending.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              All tasks done!
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {pending.map((task) => {
                const mine = task.assignedToId === user.id;
                return (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <form action={completeTaskAction} className="shrink-0">
                      <input type="hidden" name="taskId" value={task.id} />
                      <button
                        type="submit"
                        aria-label="Mark complete"
                        disabled={!!task.assignedToId && !mine}
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-500 hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </form>

                    <div className="min-w-40 flex-1">
                      <p className="font-medium text-white">{task.title}</p>
                      <p className="text-xs text-gray-500">
                        {task.area ? `${task.area} · ` : ""}
                        {task.assignedTo
                          ? `Claimed by ${task.assignedTo.name}`
                          : "Unclaimed"}{" "}
                        · added by {task.createdBy.name}
                      </p>
                    </div>

                    <Badge tone={CATEGORY_TONES[task.category] ?? "slate"}>
                      {titleCase(task.category)}
                    </Badge>
                    {task.fiveS ? (
                      <Badge tone="amber">
                        {FIVE_S_LABELS[task.fiveS as keyof typeof FIVE_S_LABELS]}
                      </Badge>
                    ) : null}
                    {task.frequency !== "ONCE" ? (
                      <Badge tone="slate">{titleCase(task.frequency)}</Badge>
                    ) : null}
                    <Badge tone={PRIORITY_TONES[task.priority] ?? "slate"}>
                      {titleCase(task.priority)}
                    </Badge>

                    {!task.assignedToId ? (
                      <form action={claimTaskAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <button
                          type="submit"
                          className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-slate-900 hover:opacity-90"
                        >
                          Assign to me
                        </button>
                      </form>
                    ) : mine ? (
                      <form action={releaseTaskAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-gray-300 hover:bg-[var(--border)]"
                        >
                          Release
                        </button>
                      </form>
                    ) : null}

                    {task.createdById === user.id || isManager ? (
                      <form action={deleteTaskAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <button
                          type="submit"
                          title="Delete task"
                          className="text-gray-600 hover:text-red-400"
                        >
                          ×
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {completed.length > 0 ? (
        <Card>
          <CardHeader title={`Completed (${completed.length})`} />
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {completed.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs text-slate-900">
                    ✓
                  </span>
                  <div className="min-w-40 flex-1">
                    <p className="font-medium text-gray-500 line-through">
                      {task.title}
                    </p>
                    <p className="text-xs text-gray-600">
                      Completed by {task.assignedTo?.name ?? "—"} ·{" "}
                      {formatDateTime(task.completedAt)}
                    </p>
                  </div>
                  <Badge tone={CATEGORY_TONES[task.category] ?? "slate"}>
                    {titleCase(task.category)}
                  </Badge>
                  <form action={reopenTaskAction}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <button
                      type="submit"
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Reopen
                    </button>
                  </form>
                  {task.createdById === user.id || isManager ? (
                    <form action={deleteTaskAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button
                        type="submit"
                        title="Delete task"
                        className="text-gray-600 hover:text-red-400"
                      >
                        ×
                      </button>
                    </form>
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
