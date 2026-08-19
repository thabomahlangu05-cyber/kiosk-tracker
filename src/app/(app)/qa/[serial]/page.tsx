import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JOB_STATUS, stageLabel } from "@/lib/enums";
import { isQaStage } from "@/lib/workflow";
import { QaForm } from "@/components/qa-form";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { KindBadge } from "@/components/ui/badge";

export default async function InspectPage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  await requireAction("qa:inspect");
  const { serial: raw } = await params;
  const serial = decodeURIComponent(raw);

  const job = await prisma.job.findFirst({
    where: { kiosk: { serialNumber: serial } },
    orderBy: { createdAt: "desc" },
    include: { kiosk: true },
  });
  if (!job) notFound();

  const atQa =
    job.status !== JOB_STATUS.COMPLETED && isQaStage(job.kind, job.currentStage);
  const defectTypes = await prisma.defectType.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-3 text-xl font-semibold text-slate-900">
          Inspect {job.kiosk.serialNumber}
          <KindBadge kind={job.kind} />
        </h1>
        <p className="text-sm text-slate-500">
          {job.kiosk.group} · stage {stageLabel(job.kind, job.currentStage)}
        </p>
      </div>

      <Card>
        <CardHeader title="QA inspection" />
        <CardBody>
          {atQa ? (
            <QaForm jobId={job.id} defectTypes={defectTypes} />
          ) : (
            <div className="text-sm text-slate-500">
              This unit is not currently at a QA stage.{" "}
              <Link
                href={`/units/${encodeURIComponent(job.kiosk.serialNumber)}`}
                className="text-blue-600 hover:underline"
              >
                View unit
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
