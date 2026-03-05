import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type CommitPayload = {
  items: Array<any>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as CommitPayload;
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ ok: false, error: "Nada para importar." }, { status: 400 });
    }

    let insertedTx = 0;
    let skippedTx = 0;
    let insertedIncome = 0;
    let skippedIncome = 0;

    for (const it of items) {
      if (it.kind === "income") {
        const exists = await prisma.income.findFirst({
          where: {
            monthKey: it.monthKey,
            person: it.person,
            type: it.incomeType,
            wallet: it.wallet,
            amountCents: it.amountCents,
            notes: it.notes ?? null
          }
        });

        if (exists) {
          skippedIncome++;
          continue;
        }

        try {
          await prisma.income.create({
            data: {
              monthKey: it.monthKey,
              person: it.person,
              type: it.incomeType,
              wallet: it.wallet,
              amountCents: it.amountCents,
              notes: it.notes ?? null
            }
          });
          insertedIncome++;
        } catch {
          skippedIncome++;
        }
        continue;
      }

      if (it.kind === "transaction") {
        try {
          await prisma.transaction.create({
            data: {
              source: it.source,
              externalId: it.externalId ?? null,
              description: it.description,
              normalized: it.normalized ?? null,
              amountCents: it.amountCents,
              occurredAt: new Date(it.occurredAt),
              monthKey: it.monthKey,
              person: it.person,
              wallet: it.wallet,
              paymentType: it.paymentType,
              categoryId: it.categoryId || null,
              tags: Array.isArray(it.tags) ? it.tags : [],
              installmentCurrent: it.installmentCurrent ?? null,
              installmentTotal: it.installmentTotal ?? null,
              notes: it.notes ?? null,
              rowHash: it.rowHash
            }
          });
          insertedTx++;
        } catch {
          skippedTx++;
        }
      }
    }

    return NextResponse.json({ ok: true, insertedTx, skippedTx, insertedIncome, skippedIncome });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}
