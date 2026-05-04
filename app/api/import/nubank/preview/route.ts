import { NextResponse } from "next/server";
import type { Person, Wallet, PaymentType, IncomeType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseNubankCsv } from "@/lib/nubankCsv";
import { applyRulesFromList, loadRules, cleanDisplayName } from "@/lib/rulesEngine";

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
      person: Person;
      wallet: Wallet;
      paymentType: PaymentType;
      categoryId: string | null;
      tags: string[];
      installmentCurrent: number | null;
      installmentTotal: number | null;
      notes: string | null;
    }
  | {
      kind: "income";
      previewId: string;
      source: string;
      externalId: string | null;
      occurredAt: string;
      monthKey: string;
      description: string;
      amountCents: number;
      person: Person;
      wallet: Wallet;
      incomeType: IncomeType;
      notes: string | null;
    };

function asUploader(v: string | null): Person {
  const x = (v || "").toUpperCase().trim();
  return x === "PEDRO" ? "PEDRO" : "MIRELA";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const uploader = asUploader(form.get("uploader")?.toString() ?? null);

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

    const [categories, txRules, incRules] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ groupName: "asc" }, { name: "asc" }]
      }),
      loadRules("TRANSACTION"),
      loadRules("INCOME")
    ]);

    const items: PreviewItem[] = [];

    for (const p of parsed) {
      const originalDesc = p.description;
      const baseNormalized = cleanDisplayName(originalDesc);

      const isAccount = p.source === "nubank_account";
      const isPositive = p.amountCents > 0;

      if (isAccount && isPositive) {
        const actIncome = applyRulesFromList(incRules, originalDesc);

        if (actIncome.incomeType) {
          const person: Person = actIncome.person ?? uploader;
          const wallet: Wallet = actIncome.wallet ?? (actIncome.incomeType === "VALE_ALIMENTACAO" ? "VALE_ALIMENTACAO" : "SALARIO");

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
            incomeType: actIncome.incomeType,
            notes: null
          });
          continue;
        }
      }

      const actTx = applyRulesFromList(txRules, originalDesc);

      const normalized = actTx.renameTo?.trim() ? actTx.renameTo.trim() : baseNormalized;

      const paymentType: PaymentType = actTx.paymentType ?? p.paymentType;
      const person: Person = actTx.person ?? uploader;
      const wallet: Wallet = actTx.wallet ?? "SALARIO";
      const categoryId = actTx.categoryId ?? null;
      const tags = actTx.tags ?? [];

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
        notes: null
      });
    }

    return NextResponse.json({ ok: true, categories, items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
