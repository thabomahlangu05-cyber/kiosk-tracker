import Link from "next/link";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JOB_STATUS, stageLabel, ROLES } from "@/lib/enums";
import { isQaStage } from "@/lib/workflow";
import { getAvailableJobs } from "@/app/actions/assignment";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { KindBadge } from "@/components/ui/badge";

export default async function QueuePage() {
  const user = await requireAction("job:advanceStage");

  const myJobs = await prisma.job.findMany({
    where: { assignedTechId: user.id, status: JOB_STATUS.IN_PROGRESS },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: { kiosk: { include: { model: true } } },
  });

  let availableJobs: any[] = [];
  if (user.role === ROLES.REPAIR_TECHNICIAN) {
    availableJobs = await getAvailableJobs();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">My work</h1>
        <p className="text-sm text-gray-400">Assigned tasks and available work</p>
      </div>

      {/* My Assigned Jobs */}
      <Card>
        <CardHeader title={`Assigned to me (${myJobs.length})`} />
        <CardBody className="p-0">
          {myJobs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">No jobs assigned.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {myJobs.map((job) => (
                <li key={job.id} className="px-4 py-3 hover:bg-[var(--border)]">
                  <Link
                    href={`/units/${encodeURIComponent(job.kiosk.serialNumber)}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--primary)]">{job.kiosk.serialNumber}</p>
                        <p className="text-xs text-gray-500">{stageLabel(job.kind, job.currentStage)}</p>
                      </div>
                      <KindBadge kind={job.kind} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Available Jobs for Self-Assignment */}
      {user.role === ROLES.REPAIR_TECHNICIAN && availableJobs.length > 0 && (
        <Card>
          <CardHeader title={`Available to claim (${availableJobs.length})`} />
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {availableJobs.map((job) => (
                <li key={job.id} className="px-4 py-3 hover:bg-[var(--border)]">
                  <Link
                    href={`/units/${encodeURIComponent(job.kiosk.serialNumber)}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{job.kiosk.serialNumber}</p>
                        <p className="text-xs text-gray-500">{stageLabel(job.kind, job.currentStage)}</p>
                      </div>
                      <div className="text-xs text-gray-400">Tap to claim →</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
