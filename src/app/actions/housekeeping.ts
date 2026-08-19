"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  FIVE_S,
  HOUSEKEEPING_CATEGORIES,
  HOUSEKEEPING_FREQUENCIES,
  PRIORITIES,
  ROLES,
} from "@/lib/enums";

function revalidateHousekeeping() {
  revalidatePath("/housekeeping");
}

/** Anyone on the floor can log a housekeeping task. */
export async function createTaskAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "GENERAL");
  const frequency = String(formData.get("frequency") ?? "ONCE");
  const priority = String(formData.get("priority") ?? PRIORITIES.NORMAL);
  const area = String(formData.get("area") ?? "").trim() || null;
  const fiveSRaw = String(formData.get("fiveS") ?? "");
  const fiveS = FIVE_S.includes(fiveSRaw as (typeof FIVE_S)[number])
    ? fiveSRaw
    : null;
  if (!title) return;

  const task = await prisma.housekeepingTask.create({
    data: {
      title,
      category: HOUSEKEEPING_CATEGORIES.includes(
        category as (typeof HOUSEKEEPING_CATEGORIES)[number],
      )
        ? category
        : "GENERAL",
      frequency: HOUSEKEEPING_FREQUENCIES.includes(
        frequency as (typeof HOUSEKEEPING_FREQUENCIES)[number],
      )
        ? frequency
        : "ONCE",
      priority,
      area,
      fiveS,
      createdById: user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "CREATED_TASK",
      entity: "HousekeepingTask",
      entityId: task.id,
      detail: JSON.stringify({ title: task.title, category: task.category }),
    },
  });

  revalidateHousekeeping();
}

/** Claim an unassigned task. */
export async function claimTaskAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  const task = await prisma.housekeepingTask.findUnique({
    where: { id: taskId },
  });
  if (!task) throw new Error("Task not found");
  if (task.assignedToId && task.assignedToId !== user.id) {
    throw new Error("Task already claimed by someone else");
  }

  await prisma.housekeepingTask.update({
    where: { id: taskId },
    data: { assignedToId: user.id, status: "ASSIGNED" },
  });

  revalidateHousekeeping();
}

/** Hand a task back to the pool. */
export async function releaseTaskAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  const task = await prisma.housekeepingTask.findUnique({
    where: { id: taskId },
  });
  if (!task) throw new Error("Task not found");
  if (task.assignedToId !== user.id) {
    throw new Error("You are not assigned to this task");
  }

  await prisma.housekeepingTask.update({
    where: { id: taskId },
    data: { assignedToId: null, status: "PENDING" },
  });

  revalidateHousekeeping();
}

/**
 * Tick a task off. Completing something nobody had claimed assigns it to you
 * in passing — it's what actually happened, and it saves a pointless click.
 */
export async function completeTaskAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  const task = await prisma.housekeepingTask.findUnique({
    where: { id: taskId },
  });
  if (!task) throw new Error("Task not found");
  if (task.assignedToId && task.assignedToId !== user.id) {
    throw new Error("Someone else is assigned to this task");
  }

  await prisma.housekeepingTask.update({
    where: { id: taskId },
    data: {
      assignedToId: user.id,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "COMPLETED_TASK",
      entity: "HousekeepingTask",
      entityId: taskId,
    },
  });

  revalidateHousekeeping();
}

/** Reopen a completed task (e.g. it wasn't actually done). */
export async function reopenTaskAction(formData: FormData): Promise<void> {
  await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  await prisma.housekeepingTask.update({
    where: { id: taskId },
    data: { status: "PENDING", completedAt: null, assignedToId: null },
  });

  revalidateHousekeeping();
}

/** Remove a task — its creator, or a team leader / manager. */
export async function deleteTaskAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;

  const task = await prisma.housekeepingTask.findUnique({
    where: { id: taskId },
  });
  if (!task) throw new Error("Task not found");

  const isManager =
    user.role === ROLES.PRODUCTION_MANAGER || user.role === ROLES.TEAM_LEADER;
  if (task.createdById !== user.id && !isManager) {
    throw new Error("Only the person who added this task can remove it");
  }

  await prisma.housekeepingTask.delete({ where: { id: taskId } });
  revalidateHousekeeping();
}

/** Every task, newest first — the page splits them into pending vs completed. */
export async function getAllTasks() {
  return prisma.housekeepingTask.findMany({
    include: { assignedTo: true, createdBy: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

/** Completed tasks per person over the last 7 days (used by Team Performance). */
export async function getHousekeepingPerformance() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const performance = await prisma.housekeepingTask.groupBy({
    by: ["assignedToId"],
    where: { status: "COMPLETED", completedAt: { gte: weekAgo } },
    _count: { id: true },
  });

  const details = await Promise.all(
    performance
      .filter((p) => p.assignedToId)
      .map(async (p) => ({
        userId: p.assignedToId,
        user: await prisma.user.findUnique({
          where: { id: p.assignedToId! },
          select: { name: true },
        }),
        tasksCompleted: p._count.id,
      })),
  );

  return details.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
}
