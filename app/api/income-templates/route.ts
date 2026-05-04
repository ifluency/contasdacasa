import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const items = await prisma.incomeTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { person: "asc" }]
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const created = await prisma.incomeTemplate.create({
    data: {
      type: body.type,
      wallet: body.wallet,
      person: body.person,
      amountCents: Number(body.amountCents),
      isActive: true
    }
  });

  return NextResponse.json({ ok: true, item: created });
}
