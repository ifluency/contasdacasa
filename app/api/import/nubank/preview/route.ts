import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseNubankCsv } from "@/lib/nubankCsv";
import { applyRules, cleanDisplayName } from "@/lib/rulesEngine";

export const runtime = "nodejs";

type PreviewItem =
  | {
      kind: "transaction";
      rowHash: string;
      source: string;
      externalId: string | null;
      occurredAt: string;
      monthKey: string;
      description: string;
      normalized: string;
      amountCents: number;
      person: "PEDRO" | "MIRELA" | "AMBOS";
      wallet: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
      paymentType: "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO" | "IGNORAR";
      categoryId: string | null;
      tags: string[];
      installmentCurrent: number | null;
      installmentTotal: number | null;
      notes: string | null;
      applied: { target: "TRANSACTION"; matched: boolean };
    }
  | {
      kind: "income";
      // income não tem rowHash, mas colocamos um id determinístico pra UI
      previewId: string;
      source: string;
      externalId: string | null;
      occurredAt: string;
      monthKey: string;
      description: string;
      amountCents: number;
      person: "PEDRO" | "MIRELA" | "AMBOS";
      wallet: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
      incomeType: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS" | "RESTANTE_MES_ANTERIOR";
      notes: string | null;
      applied: { target: "INCOME"; matched: boolean };
    };

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

    const parsed = parseNubankCsv(text);
    if (parsed.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Não consegui extrair transações desse CSV. Verifique colunas de data/descrição/valor." },
        { status: 422 }
      );
    }

    // categorias para dropdown
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ groupName: "asc" }, { name: "asc" }]
    });

    const items: PreviewItem[] = [];

    for (const p of parsed) {
      const originalDesc = p.description;
      const baseNormalized = cleanDisplayName(originalDesc);

      const isAccount = p.source === "nubank_account";
      const isPositive = p.amountCents > 0;

      // Se for conta + positivo, tenta regra INCOME
      if (isAccount && isPositive) {
        const actIncome = await applyRules("INCOME", originalDesc);
        if (actIncome.incomeType) {
          const person = ((actIncome.person ?? "AMBOS") as any) as "PEDRO" | "MIRELA" | "AMBOS";
          const wallet = ((actIncome.wallet ??
            (actIncome.incomeType === "VALE_ALIMENTACAO" ? "VALE_ALIMENTACAO" : "SALARIO")) as any) as
            | "SALARIO"
            | "VALE_ALIMENTACAO"
            | "OUTROS";

          const previewId = `income|${p.monthKey}|${person}|${actIncome.incomeType}|${p.amountCents}|${originalDesc
            .toLowerCase()
            .slice(0, 64)}`;

          items.push({
            kind: "income",
            previewId,
            source: p.source,
            externalId: p.externalId ?? null,
            occurredAt: p.occurredAt.toISOString(),
            monthKey: p.monthKey,
            description: originalDesc,
            amountCents: p.amountCents,
            person,
            wallet,
            incomeType: actIncome.incomeType as any,
            notes: originalDesc,
            applied: { target: "INCOME", matched: true }
          });

          continue;
        }
      }

      // Caso geral: TRANSACTION
      const actTx = await applyRules("TRANSACTION", originalDesc);

      const normalized =
        actTx.renameTo?.trim() ? actTx.renameTo.trim() : baseNormalized;

      const paymentType =
        (actTx.paymentType ?? p.paymentType) as any as "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO" | "IGNORAR";

      const person = ((actTx.person ?? "AMBOS") as any) as "PEDRO" | "MIRELA" | "AMBOS";
      const wallet = ((actTx.wallet ?? "SALARIO") as any) as "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
      const categoryId = (actTx.categoryId ?? null) as string | null;
      const tags = (actTx.tags ?? []) as string[];

      items.push({
        kind: "transaction",
        rowHash: p.rowHash,
        source: p.source,
        externalId: p.externalId ?? null,
        occurredAt: p.occurredAt.toISOString(),
        monthKey: p.monthKey,
        description: originalDesc,
        normalized,
        amountCents: p.amountCents,
        person,
        wallet,
        paymentType,
        categoryId,
        tags,
        installmentCurrent: p.installmentCurrent ?? null,
        installmentTotal: p.installmentTotal ?? null,
        notes: null,
        applied: { target: "TRANSACTION", matched: true }
      });
    }

    return NextResponse.json({
      ok: true,
      categories,
      items
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}
