import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PART_STATUSES, humanise } from "@/lib/enums";
import { setPartStatusAction } from "@/app/actions/board";
import { StatCard, Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_TONES: Record<string, "red" | "amber" | "green" | "blue" | "slate"> =
  {
    NEEDED: "red",
    ORDERED: "amber",
    RECEIVED: "green",
    ISSUED: "blue",
    CANCELLED: "slate",
  };

export default async function StockPage() {
  await requireUser();

  const requests = await prisma.partRequest.findMany({
    where: { status: { not: "CANCELLED" } },
    include: {
      part: true,
      requestedBy: true,
      fulfilledBy: true,
      job: { include: { kiosk: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const countBy = (s: string) =>
    requests.filter((r) => r.status === s).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Stock Overview</h1>
        <p className="text-sm text-gray-400">
          All required parts across active kiosks
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {PART_STATUSES.map((s) => (
          <StatCard key={s} label={humanise(s)} value={countBy(s)} />
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="All Required Parts" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Part</th>
                <th className="px-4 py-3 font-medium">Kiosk</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Requested by</th>
                <th className="px-4 py-3 font-medium">Issuer</th>
                <th className="px-4 py-3 font-medium">Move to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--border)]/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">
                      {r.description}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.part
                        ? `${r.part.sku} · ${r.part.quantityOnHand} in stock`
                        : "not in catalogue"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/units/${encodeURIComponent(r.job.kiosk.serialNumber)}`}
                      className="text-[var(--primary)] hover:underline"
                    >
                      {r.job.kiosk.serialNumber}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {r.job.kiosk.group}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.quantity}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONES[r.status] ?? "slate"}>
                      {humanise(r.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {r.requestedBy.name}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {r.fulfilledBy?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {PART_STATUSES.filter((s) => s !== r.status).map((s) => (
                        <form key={s} action={setPartStatusAction}>
                          <input type="hidden" name="requestId" value={r.id} />
                          <input type="hidden" name="status" value={s} />
                          <button
                            type="submit"
                            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-gray-300 hover:bg-[var(--border)] hover:text-white"
                          >
                            {humanise(s)}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No parts logged yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <p className="text-xs text-gray-500">
        Parts are added from a kiosk&apos;s Required Stock section. Marking one
        Issued also moves it out of inventory when it matches a catalogue part.
      </p>
    </div>
  );
}
