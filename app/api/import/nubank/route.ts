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

    const source = (form.get("source")?.toString() || "nubank_credit").trim();

    const text = await file.text();
    if (!text || text.length < 10) {
      return NextResponse.json({ ok: false, error: "CSV vazio ou inválido." }, { status: 400 });
    }

    const txs = parseNubankCsv(text, source);

    if (txs.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "Não consegui extrair transações desse CSV. Verifique se é o export do Nubank e se contém colunas de data/descrição/valor."
      }, { status: 422 });
    }

    // Insert com dedup (rowHash é unique)
    let inserted = 0;
    let skipped = 0;

    for (const t of txs) {
      try {
        await prisma.transaction.create({ data: t });
        inserted++;
      } catch (e: any) {
        // Unique violation => já existe
        skipped++;
      }
    }

    return NextResponse.json({
      ok: true,
      source,
      parsed: txs.length,
      inserted,
      skipped
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Erro inesperado." },
      { status: 500 }
    );
  }
}
