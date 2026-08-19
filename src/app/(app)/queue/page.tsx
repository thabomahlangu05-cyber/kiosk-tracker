import Link from "next/link";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CHECKLIST_PHASE, stageLabel } from "@/lib/enums";
import { releaseTaskAction, toggleTaskAction } from "@/app/actions/checklist";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { KindBadge, Badge } from "@/components/ui/badge";

export default async function QueuePage() {
  const user = await requireAction("job:advanceStage");

  // Work is assigned task by task now, so "my work" is the set of checklist
  // tasks this person holds — not whole kiosks they've claimed.
  const [mine, unclaimed] = await Promise.all([
    prisma.repairChecklistItem.findMany({
      where: { assignedToId: user.id, completed: false },
      include: { job: { include: { kiosk: true } } },
      orderBy: { sequence: "asc" },
    }),
    prisma.repairChecklistItem.findMany({
      where: { assignedToId: null, completed: false },
      include: { job: { include: { kiosk: true } } },
      orderBy: { sequence: "asc" },
      take: 50,
    }),
  ]);

  // Only offer tasks whose stage the unit has actually reached.
  const open = unclaimed.filter((i) =>
    i.phase === CHECKLIST_PHASE.QA
      ? i.job.currentStage === "QA"
      : i.job.currentStage === "REPAIR",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">My work</h1>
        <p className="text-sm text-gray-400">
          Tasks you&apos;ve taken on, plus what&apos;s open on the floor
        </p>
      </div>

      <Card>
        <CardHeader title={`Assigned to me (${mine.length})`} />
        <CardBody className="p-0">
          {mine.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Nothing assigned. Pick a task up below or from any kiosk.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {mine.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <form action={toggleTaskAction} className="shrink-0">
                    <input type="hidden" name="itemId" value={item.id} />
                    <button
                      type="submit"
                      aria-label="Mark complete"
                      className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-500 hover:border-[var(--primary)]"
                    />
                  </form>
                  <div className="min-w-40 flex-1">
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-xs text-gray-500">
                      {item.section}
                      {item.subsection ? ` · ${item.subsection}` : ""} ·{" "}
                      <Link
                        href={`/units/${encodeURIComponent(item.job.kiosk.serialNumber)}`}
                        className="text-[var(--primary)] hover:underline"
                      >
                        {item.job.kiosk.serialNumber}
                      </Link>
                    </p>
                  </div>
                  <Badge tone={item.phase === "QA" ? "blue" : "violet"}>
                    {item.phase === "QA" ? "QA" : "Repair"}
                  </Badge>
                  <form action={releaseTaskAction}>
                    <input type="hidden" name="itemId" value={item.id} />
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

      <Card>
        <CardHeader title={`Open on the floor (${open.length})`} />
        <CardBody className="p-0">
          {open.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Nothing unclaimed right now.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {open.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-40 flex-1">
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-xs text-gray-500">
                      {item.section}
                      {item.subsection ? ` · ${item.subsection}` : ""} ·{" "}
                      {stageLabel(item.job.kind, item.job.currentStage)}
                    </p>
                  </div>
                  <KindBadge kind={item.job.kind} />
                  <Link
                    href={`/units/${encodeURIComponent(item.job.kiosk.serialNumber)}`}
                    className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-slate-900 hover:opacity-90"
                  >
                    {item.job.kiosk.serialNumber} →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
