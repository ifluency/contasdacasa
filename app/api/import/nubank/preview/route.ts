import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseNubankCsv } from "@/lib/nubankCsv";
import { applyRules, cleanDisplayName } from "@/lib/rulesEngine";

export const runtime = "nodejs";

type Person = "PEDRO" | "MIRELA" | "AMBOS";
type Wallet = "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
type PaymentType = "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO" | "IGNORAR";
type IncomeType = "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS" | "RESTANTE_MES_ANTERIOR";

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

function asPerson(v: string | null): Person {
  const x = (v || "").toUpperCase().trim();
  if (x === "PEDRO") return "PEDRO";
  if (x === "MIRELA") return "MIRELA";
  return "AMBOS";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const uploader = asPerson(form.get("uploader")?.toString() ?? null);

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

      // Conta + positivo: tenta INCOME
      if (isAccount && isPositive) {
        const actIncome = await applyRules("INCOME", originalDesc);

        if (actIncome.incomeType) {
          const person: Person = (actIncome.person as any) ?? uploader ?? "AMBOS";
          const wallet: Wallet =
            ((actIncome.wallet ??
              (actIncome.incomeType === "VALE_ALIMENTACAO" ? "VALE_ALIMENTACAO" : "SALARIO")) as any) ?? "SALARIO";

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
            notes: null
          });

          continue;
        }
      }

      // TRANSACTION
      const actTx = await applyRules("TRANSACTION", originalDesc);

      const normalized = actTx.renameTo?.trim() ? actTx.renameTo.trim() : baseNormalized;

      const paymentType: PaymentType = ((actTx.paymentType ?? p.paymentType) as any) ?? "DEBITO_PIX";
      const person: Person = ((actTx.person ?? uploader ?? "AMBOS") as any) ?? "AMBOS";
      const wallet: Wallet = ((actTx.wallet ?? "SALARIO") as any) ?? "SALARIO";
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
        notes: null
      });
    }

    return NextResponse.json({ ok: true, categories, items });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}
