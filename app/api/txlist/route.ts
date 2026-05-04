import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const monthKey = (searchParams.get("mes") || "").trim();

  if (!monthKey) {
    return NextResponse.json({ ok: false, error: "Passe ?mes=YYYY-MM" }, { status: 400 });
  }

  const items = await prisma.transaction.findMany({
    where: { monthKey },
    orderBy: [{ occurredAt: "desc" }, { importedAt: "desc" }],
    take: 600
  });

  return NextResponse.json({ ok: true, items });
}
