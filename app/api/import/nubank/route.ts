import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseNubankCsv } from "@/lib/nubankCsv";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Envie um arquivo CSV no campo 'file'." }, { status: 400 });
    }

    const text = await file.text();
    if (!text || text.length < 10) {
      return NextResponse.json({ ok: false, error: "CSV vazio ou inválido." }, { status: 400 });
    }

    const txs = parseNubankCsv(text);

    if (txs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Não consegui extrair transações desse CSV. Verifique se contém colunas de data/descrição/valor." },
        { status: 422 }
      );
    }

    let inserted = 0;
    let skipped = 0;

    for (const t of txs) {
      try {
        await prisma.transaction.create({
          data: {
            source: t.source,
            externalId: t.externalId,
            description: t.description,
            categoryRaw: t.categoryRaw,
            amountCents: t.amountCents,
            occurredAt: t.occurredAt,
            monthKey: t.monthKey,
            paymentType: t.paymentType,
            installmentCurrent: t.installmentCurrent ?? null,
            installmentTotal: t.installmentTotal ?? null,
            rowHash: t.rowHash,
            person: "AMBOS"
          }
        });
        inserted++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({
      ok: true,
      parsed: txs.length,
      inserted,
      skipped
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}
