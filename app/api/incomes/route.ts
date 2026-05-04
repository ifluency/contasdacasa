import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const monthKey = (searchParams.get("mes") || "").trim();

  if (!monthKey) {
    return NextResponse.json({ ok: false, error: "Passe ?mes=YYYY-MM" }, { status: 400 });
  }

  const items = await prisma.income.findMany({
    where: { monthKey },
    orderBy: [{ person: "asc" }, { type: "asc" }]
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const monthKey = String(body.monthKey || "").trim();
  const person = body.person;
  const type = body.type;
  const amountCents = Number(body.amountCents);

  if (!monthKey || !person || !type || !Number.isFinite(amountCents)) {
    return NextResponse.json({ ok: false, error: "monthKey, person, type, amountCents são obrigatórios." }, { status: 400 });
  }

  const created = await prisma.income.create({
    data: { monthKey, person, type, amountCents, notes: body.notes ?? null }
  });

  return NextResponse.json({ ok: true, item: created });
}
