"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { MOVEMENT_TYPES } from "@/lib/enums";

export interface FormState {
  error?: string;
  ok?: boolean;
}

async function audit(
  actorId: string,
  action: string,
  entityId: string,
  detail: string,
) {
  await prisma.auditLog.create({
    data: { actorId, action, entity: "Part", entityId, detail },
  });
}

export async function createPart(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAction("inventory:manage");
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const reorderLevel = Number(formData.get("reorderLevel") ?? 0);
  const unitCost = Number(formData.get("unitCost") ?? 0);
  const binLocation = String(formData.get("binLocation") ?? "").trim() || null;

  if (!sku || !name) return { error: "SKU and name are required." };
  if (!Number.isFinite(reorderLevel) || reorderLevel < 0)
    return { error: "Reorder level must be 0 or more." };
  if (!Number.isFinite(unitCost) || unitCost < 0)
    return { error: "Unit cost must be 0 or more." };

  if (await prisma.part.findUnique({ where: { sku } }))
    return { error: `SKU "${sku}" already exists.` };

  await prisma.part.create({
    data: { sku, name, category, reorderLevel, unitCost, binLocation },
  });
  await audit(user.id, "createPart", sku, `${name} created`);
  revalidatePath("/inventory");
  redirect(`/inventory/${encodeURIComponent(sku)}`);
}

export async function updatePart(formData: FormData): Promise<void> {
  const user = await requireAction("inventory:manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const reorderLevel = Math.max(0, Math.trunc(Number(formData.get("reorderLevel")) || 0));
  const unitCost = Math.max(0, Number(formData.get("unitCost")) || 0);
  const category = String(formData.get("category") ?? "").trim() || null;
  const binLocation = String(formData.get("binLocation") ?? "").trim() || null;

  const part = await prisma.part.update({
    where: { id },
    data: { reorderLevel, unitCost, category, binLocation },
  });
  await audit(user.id, "updatePart", part.sku, "details updated");
  revalidatePath(`/inventory/${encodeURIComponent(part.sku)}`);
  revalidatePath("/inventory");
}

export async function receiveStock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAction("inventory:move");
  const partId = String(formData.get("partId") ?? "");
  const quantity = Math.trunc(Number(formData.get("quantity")) || 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!partId) return { error: "Missing part." };
  if (quantity <= 0) return { error: "Quantity must be greater than 0." };

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) return { error: "Part not found." };

  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        partId,
        type: MOVEMENT_TYPES.RECEIPT,
        quantity,
        userId: user.id,
        note,
      },
    }),
    prisma.part.update({
      where: { id: partId },
      data: { quantityOnHand: { increment: quantity } },
    }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "receiveStock",
        entity: "Part",
        entityId: part.sku,
        detail: `+${quantity}`,
      },
    }),
  ]);

  revalidatePath(`/inventory/${encodeURIComponent(part.sku)}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function adjustStock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAction("inventory:manage");
  const partId = String(formData.get("partId") ?? "");
  const delta = Math.trunc(Number(formData.get("delta")) || 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!partId) return { error: "Missing part." };
  if (delta === 0) return { error: "Enter a non-zero adjustment." };

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) return { error: "Part not found." };
  if (part.quantityOnHand + delta < 0)
    return { error: "Adjustment would make stock negative." };

  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        partId,
        type: MOVEMENT_TYPES.ADJUSTMENT,
        quantity: delta,
        userId: user.id,
        note,
      },
    }),
    prisma.part.update({
      where: { id: partId },
      data: { quantityOnHand: { increment: delta } },
    }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "adjustStock",
        entity: "Part",
        entityId: part.sku,
        detail: `${delta > 0 ? "+" : ""}${delta}`,
      },
    }),
  ]);

  revalidatePath(`/inventory/${encodeURIComponent(part.sku)}`);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function issuePart(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAction("inventory:move");
  const partId = String(formData.get("partId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const quantity = Math.trunc(Number(formData.get("quantity")) || 0);
  if (!partId) return { error: "Select a part." };
  if (!jobId) return { error: "Missing job." };
  if (quantity <= 0) return { error: "Quantity must be greater than 0." };

  const [part, job] = await Promise.all([
    prisma.part.findUnique({ where: { id: partId } }),
    prisma.job.findUnique({ where: { id: jobId }, include: { kiosk: true } }),
  ]);
  if (!part) return { error: "Part not found." };
  if (!job) return { error: "Unit not found." };
  if (part.quantityOnHand < quantity)
    return {
      error: `Only ${part.quantityOnHand} ${part.name} in stock.`,
    };

  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        partId,
        type: MOVEMENT_TYPES.ISSUE,
        quantity,
        jobId,
        userId: user.id,
      },
    }),
    prisma.part.update({
      where: { id: partId },
      data: { quantityOnHand: { decrement: quantity } },
    }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "issuePart",
        entity: "Job",
        entityId: job.id,
        detail: `${quantity} × ${part.name}`,
      },
    }),
  ]);

  const serial = encodeURIComponent(job.kiosk.serialNumber);
  revalidatePath(`/units/${serial}`);
  revalidatePath(`/inventory/${encodeURIComponent(part.sku)}`);
  revalidatePath("/inventory");
  return { ok: true };
}
