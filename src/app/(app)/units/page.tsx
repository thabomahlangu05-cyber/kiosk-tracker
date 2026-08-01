import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { stageLabel } from "@/lib/enums";
import { Card } from "@/components/ui/card";
import { KindBadge, StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export default async function UnitsPage() {
  const user = await requireUser();
  const viewAll = can(user.role, "units:viewAll");

  const jobs = await prisma.job.findMany({
    where: viewAll ? {} : { assignedTechId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      kiosk: { include: { model: true } },
      assignedTech: true,
      assignedTeam: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Units</h1>
          <p className="text-sm text-gray-400">
            {viewAll ? "All kiosks on the floor" : "Units assigned to you"}
          </p>
        </div>
        {can(user.role, "intake:create") ? (
          <Link
            href="/intake"
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-slate-900 hover:bg-[var(--primary-dark)]"
          >
            + New intake
          </Link>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Serial</th>
              <th className="px-4 py-2 font-medium">Model</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Assignee</th>
              <th className="px-4 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-blue-600">
                  <Link
                    href={`/units/${encodeURIComponent(job.kiosk.serialNumber)}`}
                    className="hover:underline"
                  >
                    {job.kiosk.serialNumber}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {job.kiosk.model.name}
                </td>
                <td className="px-4 py-2">
                  <KindBadge kind={job.kind} />
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {stageLabel(job.kind, job.currentStage)}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {job.assignedTech?.name ??
                    job.assignedTeam?.name ??
                    "Unassigned"}
                </td>
                <td className="px-4 py-2 text-slate-400">
                  {formatDateTime(job.createdAt)}
                </td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No units found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
