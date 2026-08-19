"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/enums";

function revalidateUnit(serialNumber: string) {
  revalidatePath(`/units/${encodeURIComponent(serialNumber)}`);
  revalidatePath("/units");
  revalidatePath("/dashboard");
}

async function loadItem(itemId: string) {
  const item = await prisma.repairChecklistItem.findUnique({
    where: { id: itemId },
    include: { job: { include: { kiosk: true } } },
  });
  if (!item) throw new Error("Checklist item not found");
  return item;
}

/** Any repair technician may claim an unassigned checklist task — this is
 * what replaces whole-job locking for the Repair stage. */
export async function selfAssignToTask(itemId: string) {
  const user = await requireUser();
  if (
    user.role !== ROLES.REPAIR_TECHNICIAN &&
    user.role !== ROLES.QA_TECHNICIAN
  ) {
    throw new Error("Only technicians can claim checklist tasks");
  }

  const item = await loadItem(itemId);
  if (item.assignedToId && item.assignedToId !== user.id) {
    throw new Error("Task already claimed by someone else");
  }

  const updated = await prisma.repairChecklistItem.update({
    where: { id: itemId },
    data: { assignedToId: user.id },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "CLAIM_CHECKLIST_TASK",
      entity: "RepairChecklistItem",
      entityId: itemId,
      detail: JSON.stringify({
        kiosk: item.job.kiosk.serialNumber,
        title: item.title,
      }),
    },
  });

  revalidateUnit(item.job.kiosk.serialNumber);
  return updated;
}

export async function unassignFromTask(itemId: string) {
  const user = await requireUser();
  const item = await loadItem(itemId);
  if (item.assignedToId !== user.id) {
    throw new Error("You are not assigned to this task");
  }

  const updated = await prisma.repairChecklistItem.update({
    where: { id: itemId },
    data: { assignedToId: null },
  });

  revalidateUnit(item.job.kiosk.serialNumber);
  return updated;
}

/** Assignee, or a team leader/production manager, may check a task complete. */
export async function toggleTaskComplete(itemId: string) {
  const user = await requireUser();
  const item = await loadItem(itemId);

  const isManager =
    user.role === ROLES.PRODUCTION_MANAGER || user.role === ROLES.TEAM_LEADER;
  if (item.assignedToId !== user.id && !isManager) {
    throw new Error("Assign yourself to this task before completing it");
  }

  const completed = !item.completed;
  const updated = await prisma.repairChecklistItem.update({
    where: { id: itemId },
    data: { completed, completedAt: completed ? new Date() : null },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: completed ? "COMPLETE_CHECKLIST_TASK" : "REOPEN_CHECKLIST_TASK",
      entity: "RepairChecklistItem",
      entityId: itemId,
      detail: JSON.stringify({
        kiosk: item.job.kiosk.serialNumber,
        title: item.title,
      }),
    },
  });

  revalidateUnit(item.job.kiosk.serialNumber);
  return updated;
}

const ADD_TASK_ROLES: string[] = [
  ROLES.REPAIR_TECHNICIAN,
  ROLES.QA_TECHNICIAN,
  ROLES.TEAM_LEADER,
  ROLES.PRODUCTION_MANAGER,
];

export async function addChecklistTask(input: {
  jobId: string;
  phase: string;
  section: string;
  subsection: string | null;
  title: string;
}) {
  const user = await requireUser();
  if (!ADD_TASK_ROLES.includes(user.role)) {
    throw new Error("Not permitted to add checklist tasks");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required");

  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    include: { kiosk: true },
  });
  if (!job) throw new Error("Job not found");

  const max = await prisma.repairChecklistItem.aggregate({
    where: { jobId: input.jobId },
    _max: { sequence: true },
  });

  const created = await prisma.repairChecklistItem.create({
    data: {
      jobId: input.jobId,
      phase: input.phase,
      section: input.section,
      subsection: input.subsection,
      title,
      sequence: (max._max.sequence ?? -1) + 1,
    },
  });

  revalidateUnit(job.kiosk.serialNumber);
  return created;
}

const DELETE_TASK_ROLES: string[] = [ROLES.TEAM_LEADER, ROLES.PRODUCTION_MANAGER];

export async function deleteChecklistTask(itemId: string) {
  const user = await requireUser();
  if (!DELETE_TASK_ROLES.includes(user.role)) {
    throw new Error("Not permitted to delete checklist tasks");
  }
  const item = await loadItem(itemId);

  await prisma.repairChecklistItem.delete({ where: { id: itemId } });

  revalidateUnit(item.job.kiosk.serialNumber);
}

/** Form-action wrappers so buttons/inputs can post directly. */
export async function claimTaskAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (itemId) await selfAssignToTask(itemId);
}

export async function releaseTaskAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (itemId) await unassignFromTask(itemId);
}

export async function toggleTaskAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (itemId) await toggleTaskComplete(itemId);
}

export async function addTaskAction(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "");
  const phase = String(formData.get("phase") ?? "REPAIR");
  const section = String(formData.get("section") ?? "");
  const subsection = String(formData.get("subsection") ?? "") || null;
  const title = String(formData.get("title") ?? "");
  if (jobId && section && title) {
    await addChecklistTask({ jobId, phase, section, subsection, title });
  }
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (itemId) await deleteChecklistTask(itemId);
}
