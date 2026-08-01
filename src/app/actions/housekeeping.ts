"use server";

import { requireUser, requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Create a new housekeeping task
 */
export async function createHousekeepingTask(data: {
  title: string;
  category: string;
  priority?: string;
  dueDate?: Date;
}) {
  const user = await requireUser();

  const task = await prisma.housekeepingTask.create({
    data: {
      title: data.title,
      category: data.category,
      priority: data.priority || "NORMAL",
      dueDate: data.dueDate,
      createdById: user.id,
    },
    include: { createdBy: true },
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

  return task;
}

/**
 * Self-assign to a housekeeping task
 */
export async function assignHousekeepingTask(taskId: string) {
  const user = await requireUser();

  const task = await prisma.housekeepingTask.findUnique({
    where: { id: taskId },
  });
  if (!task) throw new Error("Task not found");
  if (task.assignedToId) {
    throw new Error("Task already assigned");
  }

  const updated = await prisma.housekeepingTask.update({
    where: { id: taskId },
    data: {
      assignedToId: user.id,
      status: "ASSIGNED",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "ASSIGNED_TASK",
      entity: "HousekeepingTask",
      entityId: taskId,
    },
  });

  return updated;
}

/**
 * Mark housekeeping task as in progress
 */
export async function startHousekeepingTask(taskId: string) {
  const user = await requireUser();

  const task = await prisma.housekeepingTask.findUnique({
    where: { id: taskId },
  });
  if (!task) throw new Error("Task not found");
  if (task.assignedToId !== user.id) {
    throw new Error("You are not assigned to this task");
  }

  return prisma.housekeepingTask.update({
    where: { id: taskId },
    data: { status: "IN_PROGRESS" },
  });
}

/**
 * Complete housekeeping task
 */
export async function completeHousekeepingTask(taskId: string) {
  const user = await requireUser();

  const task = await prisma.housekeepingTask.findUnique({
    where: { id: taskId },
  });
  if (!task) throw new Error("Task not found");
  if (task.assignedToId !== user.id) {
    throw new Error("You are not assigned to this task");
  }

  const updated = await prisma.housekeepingTask.update({
    where: { id: taskId },
    data: {
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

  return updated;
}

/**
 * Get pending housekeeping tasks
 */
export async function getPendingTasks() {
  return prisma.housekeepingTask.findMany({
    where: {
      status: { in: ["PENDING", "ASSIGNED"] },
    },
    include: {
      assignedTo: true,
      createdBy: true,
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });
}

/**
 * Get my housekeeping tasks
 */
export async function getMyTasks() {
  const user = await requireUser();

  return prisma.housekeepingTask.findMany({
    where: {
      assignedToId: user.id,
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
    },
    include: {
      createdBy: true,
    },
    orderBy: { dueDate: "asc" },
  });
}

/**
 * Get housekeeping performance (completed tasks per user this week)
 */
export async function getHousekeepingPerformance() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const performance = await prisma.housekeepingTask.groupBy({
    by: ["assignedToId"],
    where: {
      status: "COMPLETED",
      completedAt: { gte: weekAgo },
    },
    _count: { id: true },
  });

  const details = await Promise.all(
    performance
      .filter((p) => p.assignedToId)
      .map(async (p) => ({
        userId: p.assignedToId,
        user: await prisma.user.findUnique({
          where: { id: p.assignedToId! },
          select: { name: true, teamId: true },
        }),
        tasksCompleted: p._count.id,
      })),
  );

  return details.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
}
