import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { JOB_STATUS, stageLabel } from "@/lib/enums";
import { TERMINAL_STAGES } from "@/lib/claims";
import { StatCard, Card, CardBody } from "@/components/ui/card";
import { KindBadge, Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";

const TABS = [
  { key: "all", label: "All" },
  { key: "RECEIVING", label: "Receiving" },
  { key: "REPAIR", label: "Repair" },
  { key: "QA", label: "QA" },
  { key: "BOXING", label: "Boxing" },
  { key: "DISPATCH", label: "Dispatched" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function whereForTab(tab: TabKey) {
  if (tab === "all") return {};
  if (tab === "DISPATCH") return { currentStage: "DISPATCH" };
  return { currentStage: tab, status: JOB_STATUS.IN_PROGRESS };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const user = await requireUser();
  const { stage: rawStage } = await searchParams;
  const activeTab: TabKey = (TABS.find((t) => t.key === rawStage)?.key ??
    "all") as TabKey;

  const [
    totalKiosks,
    inRepair,
    inBoxing,
    dispatched,
    unassigned,
    tabCounts,
    units,
  ] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({
      where: { currentStage: "REPAIR", status: JOB_STATUS.IN_PROGRESS },
    }),
    prisma.job.count({
      where: { currentStage: "BOXING", status: JOB_STATUS.IN_PROGRESS },
    }),
    prisma.job.count({ where: { currentStage: "DISPATCH" } }),
    prisma.job.count({
      where: {
        assignedTechId: null,
        status: JOB_STATUS.IN_PROGRESS,
        currentStage: { notIn: TERMINAL_STAGES },
      },
    }),
    Promise.all(
      TABS.map((t) =>
        t.key === "all"
          ? prisma.job.count()
          : prisma.job.count({ where: whereForTab(t.key) }),
      ),
    ),
    prisma.job.findMany({
      where: whereForTab(activeTab),
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        kiosk: true,
        assignedTech: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">
            Production Pipeline
          </h1>
          <p className="text-sm text-gray-400">
            Track every kiosk through the workflow
          </p>
        </div>
        {can(user.role, "intake:create") ? (
          <Link
            href="/intake"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-slate-900 hover:bg-[var(--primary-dark)]"
          >
            + Log Kiosk
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Kiosks" value={totalKiosks} />
        <StatCard label="In Repair" value={inRepair} />
        <StatCard label="In Boxing" value={inBoxing} />
        <StatCard label="Dispatched" value={dispatched} />
        <StatCard label="Unassigned" value={unassigned} />
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg bg-[var(--surface)] p-1">
        {TABS.map((tab, i) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/dashboard" : `/dashboard?stage=${tab.key}`}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-[var(--primary)] text-slate-900"
                : "text-gray-300 hover:bg-[var(--border)]",
            )}
          >
            {tab.label} ({tabCounts[i]})
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Kiosk ID / Group</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Assignee</th>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {units.map((job) => (
              <tr key={job.id} className="hover:bg-[var(--border)]/40">
                <td className="px-4 py-3">
                  <div className="font-semibold text-white">
                    {job.kiosk.serialNumber}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <KindBadge kind={job.kind} />
                    {job.kiosk.group}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone="green">
                    {stageLabel(job.kind, job.currentStage)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone="amber">{job.priority.toLowerCase()}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {job.assignedTech?.name ?? "Unassigned"}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {formatDateTime(job.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/units/${encodeURIComponent(job.kiosk.serialNumber)}`}
                    className="text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {units.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No kiosks in this stage.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
