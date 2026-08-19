"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAction, requireUser } from "@/lib/auth";
import { KINDS, PRIORITIES, ROLES } from "@/lib/enums";
import { firstStage, isQaStage, nextStage } from "@/lib/workflow";
import {
  REPAIR_CHECKLIST_TEMPLATE,
  QA_CHECKLIST_TEMPLATE,
} from "@/lib/repairChecklist";
import { CHECKLIST_PHASE, GROUPS } from "@/lib/enums";
import type { SessionUser } from "@/lib/session";

export interface IntakeState {
  error?: string;
}

/** Whether a user may modify (advance/assign) a given job. */
function canModifyJob(
  user: SessionUser,
  job: {
    assignedTeamId: string | null;
    assignedTechId: string | null;
    currentStage: string;
  },
): boolean {
  if (user.role === ROLES.PRODUCTION_MANAGER) return true;
  if (user.role === ROLES.TEAM_LEADER) return true;
  // Repair is a shared effort now (per-task self-assignment), so any repair
  // technician may advance it once the checklist is done — not just whoever
  // claimed the whole job.
  if (user.role === ROLES.REPAIR_TECHNICIAN && job.currentStage === "REPAIR")
    return true;
  // Otherwise technicians act on work they've claimed, whatever stage it's at.
  if (
    user.role === ROLES.REPAIR_TECHNICIAN ||
    user.role === ROLES.QA_TECHNICIAN
  )
    return job.assignedTechId === user.id;
  return false;
}

export async function createUnit(
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const user = await requireAction("intake:create");

  const serialNumber = String(formData.get("serialNumber") ?? "").trim();
  const group = String(formData.get("group") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const priority = String(formData.get("priority") ?? PRIORITIES.NORMAL);
  const assignedTechId = String(formData.get("assignedTechId") ?? "") || null;
  const buildOrderRef = String(formData.get("buildOrderRef") ?? "").trim() || null;
  const faultReport = String(formData.get("faultReport") ?? "").trim() || null;

  if (!serialNumber) return { error: "Serial number is required." };
  if (!GROUPS.includes(group as (typeof GROUPS)[number]))
    return { error: "Select a group." };
  if (kind !== KINDS.BUILD && kind !== KINDS.REPAIR)
    return { error: "Select build or repair." };

  const existing = await prisma.kiosk.findUnique({ where: { serialNumber } });
  if (existing) return { error: `Serial "${serialNumber}" already exists.` };

  const stage = firstStage(kind).name;

  // Every unit gets the QA checklist; only repairs get the repair one (builds
  // have no Repair stage). Technicians self-assign individual tasks once the
  // unit reaches the matching stage.
  const checklist = [
    ...(kind === KINDS.REPAIR
      ? REPAIR_CHECKLIST_TEMPLATE.map((t) => ({
          ...t,
          phase: CHECKLIST_PHASE.REPAIR,
        }))
      : []),
    ...QA_CHECKLIST_TEMPLATE.map((t) => ({ ...t, phase: CHECKLIST_PHASE.QA })),
  ];

  await prisma.kiosk.create({
    data: {
      serialNumber,
      group,
      kind,
      jobs: {
        create: {
          kind,
          priority,
          currentStage: stage,
          assignedTechId,
          buildOrderRef: kind === KINDS.BUILD ? buildOrderRef : null,
          faultReport: kind === KINDS.REPAIR ? faultReport : null,
          transitions: { create: { stage, userId: user.id } },
          repairChecklist: {
            create: checklist.map((t, i) => ({
              phase: t.phase,
              section: t.section,
              subsection: t.subsection,
              title: t.title,
              sequence: i,
            })),
          },
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "intake",
      entity: "Kiosk",
      entityId: serialNumber,
      detail: `${kind} intake at ${stage}`,
    },
  });

  revalidatePath("/units");
  revalidatePath("/dashboard");
  redirect(`/units/${encodeURIComponent(serialNumber)}`);
}

export async function advanceStage(formData: FormData): Promise<void> {
  const user = await requireAction("job:advanceStage");
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { kiosk: true, transitions: { where: { exitedAt: null } } },
  });
  if (!job || job.status === "COMPLETED") return;
  if (!canModifyJob(user, job)) redirect("/dashboard");

  // QA stages are only moved via a QA inspection (pass/fail), never a plain advance.
  if (isQaStage(job.kind, job.currentStage)) redirect("/qa");

  // Repair can't be left until every checklist task is checked off. An empty
  // checklist (all items deleted) is vacuously complete — always an escape
  // hatch for a manager.
  if (job.currentStage === "REPAIR") {
    const incomplete = await prisma.repairChecklistItem.count({
      where: {
        jobId: job.id,
        phase: CHECKLIST_PHASE.REPAIR,
        completed: false,
      },
    });
    if (incomplete > 0) {
      throw new Error(
        `Complete the repair checklist before advancing (${incomplete} task(s) remaining).`,
      );
    }
  }

  const next = nextStage(job.kind, job.currentStage);
  if (!next) return; // already at the final stage

  const now = new Date();
  await prisma.$transaction([
    // Close the currently-open stage transition(s).
    prisma.stageTransition.updateMany({
      where: { jobId: job.id, exitedAt: null },
      data: { exitedAt: now },
    }),
    // Open the next stage.
    prisma.stageTransition.create({
      data: { jobId: job.id, stage: next.name, userId: user.id },
    }),
    // Move the job forward; complete it if the next stage is terminal.
    prisma.job.update({
      where: { id: job.id },
      data: {
        currentStage: next.name,
        ...(next.isTerminal
          ? { status: "COMPLETED", completedAt: now }
          : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "advanceStage",
        entity: "Job",
        entityId: job.id,
        detail: `${job.currentStage} → ${next.name}`,
      },
    }),
  ]);

  const serial = encodeURIComponent(job.kiosk.serialNumber);
  revalidatePath(`/units/${serial}`);
  revalidatePath("/units");
  revalidatePath("/queue");
  revalidatePath("/dashboard");
}
