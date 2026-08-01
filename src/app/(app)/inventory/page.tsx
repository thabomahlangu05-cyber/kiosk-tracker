import Link from "next/link";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { MOVEMENT_LABELS, movementSignedQty } from "@/lib/enums";
import { partsConsumption } from "@/lib/metrics";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddPartForm } from "@/components/add-part-form";
import { formatMoney, formatDateTime } from "@/lib/utils";

export default async function InventoryPage() {
  const user = await requireAction("inventory:view");
  const canManage = can(user.role, "inventory:manage");

  const [parts, summary, movements] = await Promise.all([
    prisma.part.findMany({ orderBy: { name: "asc" } }),
    partsConsumption(),
    prisma.stockMovement.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { part: true, user: true, job: { include: { kiosk: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Inventory</h1>
        <p className="text-sm text-gray-400">
          Parts stock, movements, and consumption
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Parts" value={summary.totalParts} />
        <StatCard
          label="Low stock"
          value={summary.lowStock.length}
          hint="at/below reorder"
        />
        <StatCard label="Stock value" value={formatMoney(summary.stockValue)} />
        <StatCard
          label="Parts consumed"
          value={formatMoney(summary.consumptionCost)}
          hint={`${summary.issuedQty} units issued`}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Parts catalog" />
        <table className="w-full text-sm">
          <thead className="bg-[var(--border)] text-left text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">On hand</th>
              <th className="px-4 py-2 font-medium">Reorder</th>
              <th className="px-4 py-2 font-medium">Unit cost</th>
              <th className="px-4 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parts.map((p) => {
              const low = p.quantityOnHand <= p.reorderLevel;
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-blue-600">
                    <Link
                      href={`/inventory/${encodeURIComponent(p.sku)}`}
                      className="hover:underline"
                    >
                      {p.sku}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {p.name}
                    {p.category ? (
                      <span className="ml-2 text-xs text-slate-400">
                        {p.category}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      {p.quantityOnHand}
                      {low ? <Badge tone="red">Low</Badge> : null}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{p.reorderLevel}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {formatMoney(p.unitCost)}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {formatMoney(p.quantityOnHand * p.unitCost)}
                  </td>
                </tr>
              );
            })}
            {parts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No parts yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent movements" />
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {movements.map((m) => {
                const signed = movementSignedQty(m.type, m.quantity);
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-medium text-slate-800">
                        {m.part.name}
                      </span>
                      <span className="ml-2 text-slate-400">
                        {MOVEMENT_LABELS[m.type] ?? m.type}
                        {m.job ? ` → ${m.job.kiosk.serialNumber}` : ""} ·{" "}
                        {formatDateTime(m.createdAt)}
                      </span>
                    </span>
                    <span
                      className={
                        signed < 0
                          ? "font-medium text-red-600"
                          : "font-medium text-green-700"
                      }
                    >
                      {signed > 0 ? "+" : ""}
                      {signed}
                    </span>
                  </li>
                );
              })}
              {movements.length === 0 ? (
                <li className="px-4 py-6 text-center text-slate-400">
                  No movements yet.
                </li>
              ) : null}
            </ul>
          </CardBody>
        </Card>

        {canManage ? (
          <Card>
            <CardHeader title="Add a part" />
            <CardBody>
              <AddPartForm />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
