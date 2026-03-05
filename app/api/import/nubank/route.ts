import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseNubankCsv } from "@/lib/nubankCsv";
import { applyRules, cleanDisplayName } from "@/lib/rulesEngine";

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

    const parsed = parseNubankCsv(text);

    if (parsed.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Não consegui extrair transações desse CSV. Verifique colunas de data/descrição/valor." },
        { status: 422 }
      );
    }

    let insertedTx = 0;
    let skippedTx = 0;
    let insertedIncome = 0;
    let skippedIncome = 0;

    for (const p of parsed) {
      const originalDesc = p.description;
      const baseNormalized = cleanDisplayName(originalDesc);

      // Decide target de regra:
      // - Se for conta e valor positivo, tenta INCOME
      const isAccount = p.source === "nubank_account";
      const isPositive = p.amountCents > 0;

      if (isAccount && isPositive) {
        const act = await applyRules("INCOME", originalDesc);

        // Se existir incomeType na regra -> cria Income (entrada)
        if (act.incomeType) {
          const person = (act.person ?? "AMBOS") as any;
          const wallet = (act.wallet ?? (act.incomeType === "VALE_ALIMENTACAO" ? "VALE_ALIMENTACAO" : "SALARIO")) as any;

          const incomeHash = `income|${p.monthKey}|${person}|${act.incomeType}|${p.amountCents}|${originalDesc.toLowerCase()}`;

          try {
            // Dedup simples (não temos rowHash em Income). Vamos usar "notes" como suporte? Melhor: procurar duplicado.
            const exists = await prisma.income.findFirst({
              where: {
                monthKey: p.monthKey,
                person,
                type: act.incomeType as any,
                amountCents: p.amountCents,
                notes: originalDesc
              }
            });

            if (exists) {
              skippedIncome++;
              continue;
            }

            await prisma.income.create({
              data: {
                monthKey: p.monthKey,
                person,
                type: act.incomeType as any,
                wallet,
                amountCents: p.amountCents,
                notes: originalDesc
              }
            });

            insertedIncome++;
            continue; // não cria Transaction para entrada
          } catch {
            skippedIncome++;
            continue;
          }
        }

        // Se não tem regra de income, cai como Transaction normal (entrada genérica)
      }

      // TRANSACTION RULES
      const act = await applyRules("TRANSACTION", originalDesc);

      const normalized = act.renameTo?.trim()
        ? act.renameTo.trim()
        : baseNormalized;

      try {
        await prisma.transaction.create({
          data: {
            source: p.source,
            externalId: p.externalId ?? null,
            description: originalDesc,
            normalized,

            amountCents: p.amountCents,
            occurredAt: p.occurredAt,
            monthKey: p.monthKey,

            paymentType: (act.paymentType ?? p.paymentType) as any,
            person: (act.person ?? "AMBOS") as any,
            wallet: (act.wallet ?? "SALARIO") as any,

            categoryId: act.categoryId ?? null,
            tags: act.tags ?? [],

            installmentCurrent: p.installmentCurrent ?? null,
            installmentTotal: p.installmentTotal ?? null,

            categoryRaw: p.categoryRaw ?? null,
            rowHash: p.rowHash
          }
        });
        insertedTx++;
      } catch {
        skippedTx++;
      }
    }

    return NextResponse.json({
      ok: true,
      parsed: parsed.length,
      insertedTx,
      skippedTx,
      insertedIncome,
      skippedIncome
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}
