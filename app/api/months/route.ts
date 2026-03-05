import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.transaction.findMany({
    select: { monthKey: true },
    distinct: ["monthKey"],
    orderBy: { monthKey: "desc" }
  });

  const keys = rows.map((r) => r.monthKey);
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (!keys.includes(current)) keys.unshift(current);

  return NextResponse.json({ ok: true, items: keys.slice(0, 24) });
}
