"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { CHECKLIST_PHASE, JOB_STATUS, QA_RESULT } from "@/lib/enums";
import { isQaStage, nextStage, reworkStage } from "@/lib/workflow";

export interface QaState {
  error?: string;
}

export async function recordInspection(
  _prev: QaState,
  formData: FormData,
): Promise<QaState> {
  const user = await requireAction("qa:inspect");

  const jobId = String(formData.get("jobId") ?? "");
  const result = String(formData.get("result") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const defectTypeIds = formData
    .getAll("defectTypeIds")
    .map(String)
    .filter(Boolean);

  if (result !== QA_RESULT.PASS && result !== QA_RESULT.FAIL) {
    return { error: "Select Pass or Fail." };
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { kiosk: true },
  });
  if (!job || job.status === JOB_STATUS.COMPLETED) {
    return { error: "Unit is not available for inspection." };
  }
  if (!isQaStage(job.kind, job.currentStage)) {
    return { error: "Unit is not currently at a QA stage." };
  }
  if (result === QA_RESULT.FAIL && defectTypeIds.length === 0) {
    return { error: "Select at least one defect for a failed inspection." };
  }
  // A pass means the QA checklist was actually worked through. A fail can be
  // recorded at any point — that's the whole point of catching a problem early.
  if (result === QA_RESULT.PASS) {
    const incomplete = await prisma.repairChecklistItem.count({
      where: { jobId, phase: CHECKLIST_PHASE.QA, completed: false },
    });
    if (incomplete > 0) {
      return {
        error: `Complete the QA checklist before passing (${incomplete} check(s) remaining).`,
      };
    }
  }

  // PASS advances to the next stage (Dispatch → complete); FAIL routes to rework.
  const target =
    result === QA_RESULT.PASS
      ? nextStage(job.kind, job.currentStage)
      : reworkStage(job.kind);
  if (!target) return { error: "No stage to move to after QA." };

  const now = new Date();
  await prisma.$transaction([
    prisma.qAInspection.create({
      data: {
        jobId,
        inspectorId: user.id,
        result,
        notes,
        defects: {
          create: defectTypeIds.map((defectTypeId) => ({ defectTypeId })),
        },
      },
    }),
    prisma.stageTransition.updateMany({
      where: { jobId, exitedAt: null },
      data: { exitedAt: now },
    }),
    prisma.stageTransition.create({
      data: { jobId, stage: target.name, userId: user.id },
    }),
    prisma.job.update({
      where: { id: jobId },
      data: {
        currentStage: target.name,
        ...(result === QA_RESULT.PASS && target.isTerminal
          ? { status: JOB_STATUS.COMPLETED, completedAt: now }
          : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "qaInspection",
        entity: "Job",
        entityId: jobId,
        detail: `${result}${
          defectTypeIds.length ? ` · ${defectTypeIds.length} defect(s)` : ""
        }`,
      },
    }),
    // A failed unit goes back for rework, so its QA checks have to be done
    // again once it returns — otherwise the second inspection would open with
    // every check already ticked from the first pass. Repair tasks are left
    // alone: a fault usually means redoing one thing, not all 25.
    ...(result === QA_RESULT.FAIL
      ? [
          prisma.repairChecklistItem.updateMany({
            where: { jobId, phase: CHECKLIST_PHASE.QA },
            data: { completed: false, completedAt: null, assignedToId: null },
          }),
        ]
      : []),
  ]);

  const serial = encodeURIComponent(job.kiosk.serialNumber);
  revalidatePath(`/units/${serial}`);
  revalidatePath("/qa");
  revalidatePath("/units");
  revalidatePath("/dashboard");
  redirect(`/units/${serial}`);
}
