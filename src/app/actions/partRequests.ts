"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { MOVEMENT_TYPES, PART_REQUEST_STATUS, ROLES } from "@/lib/enums";

/** Roles that may ask for parts against a job. */
const REQUEST_ROLES: string[] = [
  ROLES.REPAIR_TECHNICIAN,
  ROLES.QA_TECHNICIAN,
  ROLES.TEAM_LEADER,
  ROLES.PRODUCTION_MANAGER,
];

function revalidateUnit(serialNumber: string) {
  revalidatePath(`/units/${encodeURIComponent(serialNumber)}`);
  revalidatePath("/inventory");
}

/** Technician asks for a part. Free text is allowed — anything the store
 * doesn't carry as a catalogue item still needs recording. */
export async function requestPartAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!REQUEST_ROLES.includes(user.role)) {
    throw new Error("Not permitted to request parts");
  }

  const jobId = String(formData.get("jobId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const quantity = Math.trunc(Number(formData.get("quantity")) || 1);
  if (!jobId || !description) return;
  if (quantity <= 0) throw new Error("Quantity must be greater than 0");

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { kiosk: true },
  });
  if (!job) throw new Error("Unit not found");

  // Link to the catalogue when the text matches a part name or SKU, so
  // fulfilling the request can move real stock.
  const match = await prisma.part.findFirst({
    where: {
      OR: [
        { name: { equals: description, mode: "insensitive" } },
        { sku: { equals: description, mode: "insensitive" } },
      ],
    },
  });

  await prisma.partRequest.create({
    data: {
      jobId,
      partId: match?.id ?? null,
      description: match?.name ?? description,
      quantity,
      requestedById: user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "REQUEST_PART",
      entity: "Job",
      entityId: jobId,
      detail: `${quantity} × ${match?.name ?? description}`,
    },
  });

  revalidateUnit(job.kiosk.serialNumber);
}

/** Requester, team leader or manager withdraws a pending request. */
export async function cancelPartRequestAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("requestId") ?? "");
  if (!id) return;

  const req = await prisma.partRequest.findUnique({
    where: { id },
    include: { job: { include: { kiosk: true } } },
  });
  if (!req) throw new Error("Request not found");
  if (req.status !== PART_REQUEST_STATUS.NEEDED) {
    throw new Error("Only pending requests can be cancelled");
  }

  const isManager =
    user.role === ROLES.PRODUCTION_MANAGER || user.role === ROLES.TEAM_LEADER;
  if (req.requestedById !== user.id && !isManager) {
    throw new Error("You did not make this request");
  }

  await prisma.partRequest.update({
    where: { id },
    data: { status: PART_REQUEST_STATUS.CANCELLED },
  });

  revalidateUnit(req.job.kiosk.serialNumber);
}

/**
 * Inventory issues the requested part: decrements stock, records the ISSUE
 * movement, and marks the request fulfilled — all in one transaction so stock
 * can never drop without the request reflecting it.
 */
export async function fulfilPartRequestAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can(user.role, "inventory:move")) {
    throw new Error("Only inventory staff can issue parts");
  }

  const id = String(formData.get("requestId") ?? "");
  if (!id) return;

  const req = await prisma.partRequest.findUnique({
    where: { id },
    include: { job: { include: { kiosk: true } }, part: true },
  });
  if (!req) throw new Error("Request not found");
  if (req.status !== PART_REQUEST_STATUS.NEEDED) {
    throw new Error("Request is not pending");
  }
  if (!req.part) {
    throw new Error(
      "This request isn't linked to a catalogue part — add it to the catalogue first",
    );
  }
  if (req.part.quantityOnHand < req.quantity) {
    throw new Error(
      `Only ${req.part.quantityOnHand} ${req.part.name} in stock (${req.quantity} requested)`,
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
      where: { id },
      data: {
        status: PART_REQUEST_STATUS.ISSUED,
        fulfilledById: user.id,
        fulfilledAt: new Date(),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "FULFIL_PART_REQUEST",
        entity: "Job",
        entityId: req.jobId,
        detail: `${req.quantity} × ${req.part.name}`,
      },
    }),
  ]);

  revalidateUnit(req.job.kiosk.serialNumber);
  revalidatePath(`/inventory/${encodeURIComponent(req.part.sku)}`);
}
