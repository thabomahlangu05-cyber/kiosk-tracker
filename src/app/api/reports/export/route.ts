import { NextRequest, NextResponse } from "next/server";
import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAction("reports:view");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(30, Math.max(1, Number(searchParams.get("range")) || 1));

  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const jobs = await prisma.job.findMany({
    where: { completedAt: { gte: from, lte: to } },
    include: {
      kiosk: true,
      inspections: { orderBy: { createdAt: "asc" } },
      stockMovements: { where: { type: "ISSUE" }, include: { part: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  const rows = jobs.map((j) => {
    const turnaroundMs = j.completedAt
      ? j.completedAt.getTime() - j.createdAt.getTime()
      : 0;
    const turnaroundHours = (turnaroundMs / 3600000).toFixed(2);
    const firstQa = j.inspections[0]?.result ?? "—";
    const partsCost = j.stockMovements.reduce(
      (sum, m) => sum + m.quantity * m.part.unitCost,
      0,
    );

    return {
      serial: j.kiosk.serialNumber,
      kind: j.kind,
      status: j.status,
      turnaround_hours: turnaroundHours,
      first_qa: firstQa,
      parts_cost: partsCost.toFixed(2),
      created: j.createdAt.toISOString().slice(0, 10),
      completed: j.completedAt?.toISOString().slice(0, 10) ?? "—",
    };
  });

  // CSV header + rows
  const header = Object.keys(rows[0] || {}).join(",");
  const body = rows
    .map((r) =>
      Object.values(r)
        .map((v) => {
          const s = String(v);
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  const csv = header ? `${header}\n${body}` : "";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="production-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
