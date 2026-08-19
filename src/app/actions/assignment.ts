"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canClaimWork, TERMINAL_STAGES } from "@/lib/claims";

function revalidateQueues(serialNumber?: string) {
  revalidatePath("/queue");
  revalidatePath("/units");
  revalidatePath("/dashboard");
  if (serialNumber) revalidatePath(`/units/${encodeURIComponent(serialNumber)}`);
}

/** Technician claims an unassigned job, at whatever stage it currently sits. */
export async function selfAssignToJob(jobId: string) {
  const user = await requireUser();

  if (!canClaimWork(user.role)) {
    throw new Error("Only technicians can self-assign");
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (job.status === "COMPLETED") throw new Error("Job is already complete");
  if (job.assignedTechId && job.assignedTechId !== user.id) {
    throw new Error("Job already assigned to someone else");
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { assignedTechId: user.id },
    include: { kiosk: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "SELF_ASSIGNED",
      entity: "Job",
      entityId: jobId,
      detail: JSON.stringify({
        kiosk: updated.kiosk.serialNumber,
        stage: updated.currentStage,
      }),
    },
  });

  revalidateQueues(updated.kiosk.serialNumber);
  return updated;
}

/** Technician releases a job back to the open queue. */
export async function unassignFromJob(jobId: string) {
  const user = await requireUser();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { kiosk: true },
  });
  if (!job) throw new Error("Job not found");
  if (job.assignedTechId !== user.id) {
    throw new Error("You are not assigned to this job");
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { assignedTechId: null },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "UNASSIGNED",
      entity: "Job",
      entityId: jobId,
      detail: JSON.stringify({ stage: job.currentStage }),
    },
  });

  revalidateQueues(job.kiosk.serialNumber);
  return updated;
}

/**
 * Unassigned, still-running jobs at any non-terminal stage. Returns an empty
 * list for roles that don't claim work, so pages can call it unconditionally.
 */
export async function getAvailableJobs() {
  const user = await requireUser();
  if (!canClaimWork(user.role)) return [];

  return prisma.job.findMany({
    where: {
      assignedTechId: null,
      status: "IN_PROGRESS",
      // REPAIR is excluded: that stage uses per-task self-assignment (see
      // src/app/actions/checklist.ts) instead of whole-job claim/release.
      currentStage: { notIn: [...TERMINAL_STAGES, "REPAIR"] },
    },
    include: { kiosk: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

/** The signed-in technician's own in-progress jobs. */
export async function getMyJobs() {
  const user = await requireUser();
  if (!canClaimWork(user.role)) return [];

  return prisma.job.findMany({
    where: { assignedTechId: user.id, status: "IN_PROGRESS" },
    include: { kiosk: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

/** Form-action wrappers so a button can post a jobId directly. */
export async function claimJob(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "");
  if (jobId) await selfAssignToJob(jobId);
}

export async function releaseJob(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "");
  if (jobId) await unassignFromJob(jobId);
}
