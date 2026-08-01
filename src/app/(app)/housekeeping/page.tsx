import { requireUser } from "@/lib/auth";
import { getPendingTasks, getMyTasks } from "@/app/actions/housekeeping";
import { assignHousekeepingTask, completeHousekeepingTask } from "@/app/actions/housekeeping";
import { Card, CardHeader, CardBody, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PRIORITY_COLORS = {
  LOW: "slate",
  NORMAL: "blue",
  HIGH: "amber",
  URGENT: "red",
} as const;

const CATEGORY_COLORS = {
  CLEANING: "green",
  TOOLS: "blue",
  SAFETY: "red",
  GENERAL: "slate",
} as const;

export default async function HousekeepingPage() {
  const user = await requireUser();
  const [pending, myTasks] = await Promise.all([getPendingTasks(), getMyTasks()]);

  const totalPending = pending.length;
  const myAssigned = myTasks.filter((t: any) => t.status === "ASSIGNED").length;
  const myInProgress = myTasks.filter((t: any) => t.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Housekeeping</h1>
        <p className="text-sm text-gray-400">Maintenance tasks and team organization</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Pending" value={totalPending} />
        <StatCard label="Assigned to me" value={myAssigned} />
        <StatCard label="In progress" value={myInProgress} />
        <StatCard label="My completed" value={myTasks.filter((t: any) => t.status === "COMPLETED").length} hint="this week" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Available tasks" />
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {pending
                .filter((t: any) => !t.assignedToId)
                .map((task: any) => (
                  <li key={task.id} className="px-4 py-3 hover:bg-[var(--border)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-white">{task.title}</p>
                        <div className="mt-1 flex gap-2">
                          <Badge tone={CATEGORY_COLORS[task.category as keyof typeof CATEGORY_COLORS] || "slate"}>
                            {task.category}
                          </Badge>
                          <Badge tone={PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || "slate"}>
                            {task.priority}
                          </Badge>
                        </div>
                        {task.dueDate && (
                          <p className="mt-1 text-xs text-gray-500">
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <form action={async () => { "use server"; await assignHousekeepingTask(task.id); }}>
                        <button type="submit" className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-[var(--primary-dark)]">
                          Assign
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              {pending.filter((t: any) => !t.assignedToId).length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-gray-500">No available tasks</li>
              )}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="My tasks" />
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {myTasks.map((task: any) => (
                <li key={task.id} className="px-4 py-3 hover:bg-[var(--border)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-white">{task.title}</p>
                      <p className="text-xs text-gray-500">{task.status}</p>
                    </div>
                    {task.status === "ASSIGNED" && (
                      <form action={async () => { "use server"; await completeHousekeepingTask(task.id); }}>
                        <button type="submit" className="text-xs font-medium text-[var(--primary)] hover:underline">
                          Done
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
              {myTasks.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-gray-500">No tasks assigned</li>
              )}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
