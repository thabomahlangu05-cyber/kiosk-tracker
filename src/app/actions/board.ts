"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ANNOUNCEMENT_CATEGORIES,
  IDEA_STATUSES,
  MOVEMENT_TYPES,
  PART_STATUSES,
  ROLES,
} from "@/lib/enums";

// --- Communications --------------------------------------------------------

/** Anyone on the floor can post an update to the whole team. */
export async function postAnnouncementAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "GENERAL");
  const kioskRef = String(formData.get("kioskRef") ?? "").trim() || null;
  if (!body) return;

  await prisma.announcement.create({
    data: {
      body,
      category: ANNOUNCEMENT_CATEGORIES.includes(
        category as (typeof ANNOUNCEMENT_CATEGORIES)[number],
      )
        ? category
        : "GENERAL",
      kioskRef,
      authorId: user.id,
    },
  });

  revalidatePath("/communications");
}

/** Author, or a leader/manager, can take an update down. */
export async function deleteAnnouncementAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const item = await prisma.announcement.findUnique({ where: { id } });
  if (!item) throw new Error("Update not found");

  const isManager =
    user.role === ROLES.PRODUCTION_MANAGER || user.role === ROLES.TEAM_LEADER;
  if (item.authorId !== user.id && !isManager) {
    throw new Error("Only the author can remove this update");
  }

  await prisma.announcement.delete({ where: { id } });
  revalidatePath("/communications");
}

// --- Ideas -----------------------------------------------------------------

export async function submitIdeaAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) return;

  await prisma.idea.create({
    data: { title, description, authorId: user.id },
  });

  revalidatePath("/ideas");
}

/** Vote is a toggle — voting again withdraws it. One vote per person. */
export async function voteIdeaAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const ideaId = String(formData.get("ideaId") ?? "");
  if (!ideaId) return;

  const existing = await prisma.ideaVote.findUnique({
    where: { ideaId_userId: { ideaId, userId: user.id } },
  });

  if (existing) {
    await prisma.ideaVote.delete({ where: { id: existing.id } });
  } else {
    await prisma.ideaVote.create({ data: { ideaId, userId: user.id } });
  }

  revalidatePath("/ideas");
}

/** Moving an idea through review is a manager/leader call. */
export async function setIdeaStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (
    user.role !== ROLES.PRODUCTION_MANAGER &&
    user.role !== ROLES.TEAM_LEADER
  ) {
    throw new Error("Only a team leader or manager can change an idea's status");
  }

  const ideaId = String(formData.get("ideaId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!ideaId || !IDEA_STATUSES.includes(status as IdeaStatusValue)) return;

  await prisma.idea.update({ where: { id: ideaId }, data: { status } });
  revalidatePath("/ideas");
}
type IdeaStatusValue = (typeof IDEA_STATUSES)[number];

export async function deleteIdeaAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const idea = await prisma.idea.findUnique({ where: { id } });
  if (!idea) throw new Error("Idea not found");

  const isManager =
    user.role === ROLES.PRODUCTION_MANAGER || user.role === ROLES.TEAM_LEADER;
  if (idea.authorId !== user.id && !isManager) {
    throw new Error("Only the author can remove this idea");
  }

  await prisma.idea.delete({ where: { id } });
  revalidatePath("/ideas");
}

// --- Stock -----------------------------------------------------------------

/**
 * Move a requested part along Needed -> Ordered -> Received -> Issued.
 * Open to everyone: the store runs on whoever is standing at the shelf.
 * Reaching ISSUED on a catalogue-linked part also moves real stock, which is
 * why that step is transactional and refuses to oversell.
 */
export async function setPartStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!requestId || !PART_STATUSES.includes(status as PartStatusValue)) return;

  const req = await prisma.partRequest.findUnique({
    where: { id: requestId },
    include: { part: true, job: { include: { kiosk: true } } },
  });
  if (!req) throw new Error("Request not found");
  if (req.status === status) return;

  const becomingIssued = status === "ISSUED" && req.status !== "ISSUED";

  if (becomingIssued && req.part) {
    if (req.part.quantityOnHand < req.quantity) {
      throw new Error(
        `Only ${req.part.quantityOnHand} ${req.part.name} in stock (${req.quantity} needed)`,
      );
    }
    await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          partId: req.part.id,
          type: MOVEMENT_TYPES.ISSUE,
          quantity: req.quantity,
          jobId: req.jobId,
          userId: user.id,
        },
      }),
      prisma.part.update({
        where: { id: req.part.id },
        data: { quantityOnHand: { decrement: req.quantity } },
      }),
      prisma.partRequest.update({
        where: { id: requestId },
        data: {
          status,
          fulfilledById: user.id,
          fulfilledAt: new Date(),
        },
      }),
    ]);
  } else {
    await prisma.partRequest.update({
      where: { id: requestId },
      data: {
        status,
        ...(becomingIssued
          ? { fulfilledById: user.id, fulfilledAt: new Date() }
          : {}),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "PART_STATUS",
      entity: "PartRequest",
      entityId: requestId,
      detail: `${req.status} → ${status} · ${req.quantity} × ${req.description}`,
    },
  });

  revalidatePath("/stock");
  revalidatePath(`/units/${encodeURIComponent(req.job.kiosk.serialNumber)}`);
  revalidatePath("/inventory");
}
type PartStatusValue = (typeof PART_STATUSES)[number];
