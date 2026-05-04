import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const monthKey = String(body.monthKey || "").trim();

  if (!monthKey) {
    return NextResponse.json({ ok: false, error: "monthKey obrigatório (YYYY-MM)" }, { status: 400 });
  }

  const templates = await prisma.incomeTemplate.findMany({
    where: { isActive: true }
  });

  let created = 0;
  let skipped = 0;

  for (const t of templates) {
    const exists = await prisma.income.findFirst({
      where: {
        monthKey,
        person: t.person,
        type: t.type,
        wallet: t.wallet,
        amountCents: t.amountCents
      }
    });

    if (exists) {
      skipped++;
      continue;
    }

    await prisma.income.create({
      data: {
        monthKey,
        person: t.person,
        type: t.type,
        wallet: t.wallet,
        amountCents: t.amountCents,
        notes: "Gerado automaticamente (template)"
      }
    });
    created++;
  }

  return NextResponse.json({ ok: true, created, skipped });
}
