"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/enums";

/**
 * Technician self-assigns to a repair job
 */
export async function selfAssignToJob(jobId: string) {
  const user = await requireUser();

  if (user.role !== ROLES.REPAIR_TECHNICIAN) {
    throw new Error("Only repair technicians can self-assign");
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");
  if (job.assignedTechId) {
    throw new Error("Job already assigned to someone else");
  }

  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { assignedTechId: user.id },
    include: { kiosk: true },
  });

  // Log assignment
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "SELF_ASSIGNED",
      entity: "Job",
      entityId: jobId,
      detail: JSON.stringify({ kiosk: updated.kiosk.serialNumber }),
    },
  });

  return updated;
}

/**
 * Technician unassigns themselves from a job
 */
export async function unassignFromJob(jobId: string) {
  const user = await requireUser();

  const job = await prisma.job.findUnique({ where: { id: jobId } });
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
    },
  });

  return updated;
}

/**
 * Get available repair jobs (not yet assigned)
 */
export async function getAvailableJobs() {
  const user = await requireUser();

  if (user.role !== ROLES.REPAIR_TECHNICIAN) {
    throw new Error("Only repair technicians can view available jobs");
  }

  const jobs = await prisma.job.findMany({
    where: {
      assignedTechId: null,
      status: "IN_PROGRESS",
      currentStage: { in: ["Repair", "Rework"] },
    },
    include: {
      kiosk: { include: { model: true } },
      assignedTeam: true,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return jobs;
}

/**
 * Get technician's assigned jobs
 */
export async function getMyJobs() {
  const user = await requireUser();

  if (user.role !== ROLES.REPAIR_TECHNICIAN) {
    throw new Error("Only repair technicians can view assigned jobs");
  }

  const jobs = await prisma.job.findMany({
    where: {
      assignedTechId: user.id,
      status: "IN_PROGRESS",
    },
    include: {
      kiosk: { include: { model: true } },
      assignedTeam: true,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return jobs;
}
