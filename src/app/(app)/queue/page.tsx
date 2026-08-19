import Link from "next/link";
import { requireAction } from "@/lib/auth";
import { stageLabel } from "@/lib/enums";
import { canClaimWork } from "@/lib/claims";
import {
  getAvailableJobs,
  getMyJobs,
  claimJob,
  releaseJob,
} from "@/app/actions/assignment";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { KindBadge } from "@/components/ui/badge";

export default async function QueuePage() {
  const user = await requireAction("job:advanceStage");
  const claims = canClaimWork(user.role);

  const [myJobs, availableJobs] = await Promise.all([
    getMyJobs(),
    getAvailableJobs(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">My work</h1>
        <p className="text-sm text-gray-400">
          {claims
            ? "Work you've claimed, plus everything open on the floor"
            : "Technicians claim work here"}
        </p>
      </div>

      {/* Claimed by me */}
      <Card>
        <CardHeader title={`Assigned to me (${myJobs.length})`} />
        <CardBody className="p-0">
          {myJobs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              {claims
                ? "No jobs assigned. Claim one below to get started."
                : "No jobs assigned."}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {myJobs.map((job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <Link
                    href={`/units/${encodeURIComponent(job.kiosk.serialNumber)}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="font-medium text-[var(--primary)]">
                      {job.kiosk.serialNumber}
                    </p>
                    <p className="text-xs text-gray-500">
                      {stageLabel(job.kind, job.currentStage)}
                    </p>
                  </Link>
                  <KindBadge kind={job.kind} />
                  <form action={releaseJob}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-gray-300 hover:bg-[var(--border)]"
                    >
                      Release
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Open on the floor */}
      {claims && (
        <Card>
          <CardHeader title={`Available to claim (${availableJobs.length})`} />
          <CardBody className="p-0">
            {availableJobs.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                Nothing unassigned right now.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {availableJobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <Link
                      href={`/units/${encodeURIComponent(job.kiosk.serialNumber)}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="font-medium text-white">
                        {job.kiosk.serialNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {stageLabel(job.kind, job.currentStage)}
                      </p>
                    </Link>
                    <KindBadge kind={job.kind} />
                    <form action={claimJob}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                      >
                        Claim
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
