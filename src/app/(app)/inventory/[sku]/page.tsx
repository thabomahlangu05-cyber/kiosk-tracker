import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { MOVEMENT_LABELS, movementSignedQty } from "@/lib/enums";
import { updatePart } from "@/app/actions/inventory";
import { ReceiveForm, AdjustForm } from "@/components/part-stock-forms";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { formatMoney, formatDateTime } from "@/lib/utils";

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const user = await requireAction("inventory:view");
  const { sku: raw } = await params;
  const sku = decodeURIComponent(raw);

  const part = await prisma.part.findUnique({
    where: { sku },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: true, job: { include: { kiosk: true } } },
      },
    },
  });
  if (!part) notFound();

  const canMove = can(user.role, "inventory:move");
  const canManage = can(user.role, "inventory:manage");
  const low = part.quantityOnHand <= part.reorderLevel;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventory" className="text-sm text-blue-600 hover:underline">
          ← Inventory
        </Link>
        <h1 className="mt-1 flex items-center gap-3 text-xl font-semibold text-slate-900">
          {part.name}
          <span className="text-base font-normal text-slate-400">{part.sku}</span>
          {low ? <Badge tone="red">Low stock</Badge> : null}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Stock" />
          <CardBody className="space-y-2 text-sm">
            <Row label="On hand" value={String(part.quantityOnHand)} />
            <Row label="Reorder level" value={String(part.reorderLevel)} />
            <Row label="Unit cost" value={formatMoney(part.unitCost)} />
            <Row
              label="Stock value"
              value={formatMoney(part.quantityOnHand * part.unitCost)}
            />
            <Row label="Category" value={part.category ?? "—"} />
            <Row label="Bin" value={part.binLocation ?? "—"} />
          </CardBody>
        </Card>

        {canMove ? (
          <Card className="lg:col-span-1">
            <CardHeader title="Receive stock" />
            <CardBody>
              <ReceiveForm partId={part.id} />
            </CardBody>
          </Card>
        ) : null}

        {canManage ? (
          <Card className="lg:col-span-1">
            <CardHeader title="Adjust stock" />
            <CardBody>
              <AdjustForm partId={part.id} />
            </CardBody>
          </Card>
        ) : null}
      </div>

      {canManage ? (
        <Card>
          <CardHeader title="Edit part" />
          <CardBody>
            <form
              action={updatePart}
              className="flex flex-wrap items-end gap-4"
            >
              <input type="hidden" name="id" value={part.id} />
              <div className="w-32">
                <Label htmlFor="reorderLevel">Reorder level</Label>
                <Input
                  id="reorderLevel"
                  name="reorderLevel"
                  type="number"
                  min="0"
                  defaultValue={part.reorderLevel}
                />
              </div>
              <div className="w-32">
                <Label htmlFor="unitCost">Unit cost (₱)</Label>
                <Input
                  id="unitCost"
                  name="unitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={part.unitCost}
                />
              </div>
              <div className="w-40">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  name="category"
                  defaultValue={part.category ?? ""}
                />
              </div>
              <div className="w-28">
                <Label htmlFor="binLocation">Bin</Label>
                <Input
                  id="binLocation"
                  name="binLocation"
                  defaultValue={part.binLocation ?? ""}
                />
              </div>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader title="Movement history" />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Unit</th>
              <th className="px-4 py-2 font-medium">By</th>
              <th className="px-4 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {part.movements.map((m) => {
              const signed = movementSignedQty(m.type, m.quantity);
              return (
                <tr key={m.id}>
                  <td className="px-4 py-2 text-slate-500">
                    {formatDateTime(m.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {MOVEMENT_LABELS[m.type] ?? m.type}
                  </td>
                  <td
                    className={
                      signed < 0
                        ? "px-4 py-2 font-medium text-red-600"
                        : "px-4 py-2 font-medium text-green-700"
                    }
                  >
                    {signed > 0 ? "+" : ""}
                    {signed}
                  </td>
                  <td className="px-4 py-2 text-blue-600">
                    {m.job ? (
                      <Link
                        href={`/units/${encodeURIComponent(m.job.kiosk.serialNumber)}`}
                        className="hover:underline"
                      >
                        {m.job.kiosk.serialNumber}
                      </Link>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {m.user?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-400">{m.note ?? ""}</td>
                </tr>
              );
            })}
            {part.movements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No movements recorded.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}
