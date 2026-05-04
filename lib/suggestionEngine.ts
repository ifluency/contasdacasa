import type { PrismaClient } from "@prisma/client";

export type SuggestionResult = {
  categoryId: string;
  confidence: number;
  sourceDescription: string;
  suggestedNormalized?: string;
  suggestedPerson?: "PEDRO" | "MIRELA" | "AMBOS";
  suggestedWallet?: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
  suggestedPaymentType?: "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO";
  suggestedTags: string[];
};

type CategorizedTx = {
  description: string;
  categoryId: string;
  normalized: string | null;
  person: string;
  wallet: string;
  paymentType: string;
  tags: string[];
  occurredAt: Date;
};

const NOISE_TOKENS = new Set(["pix", "pag", "dm", "ifd", "pg"]);

export function tokenize(description: string): string[] {
  return description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[\s*\/\-\.]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 3)
    .filter((t) => !/^\d{6,}$/.test(t))
    .filter((t) => !NOISE_TOKENS.has(t));
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

const SUGGESTION_THRESHOLD = 0.6;

export function findBestMatch(
  description: string,
  history: CategorizedTx[]
): SuggestionResult | null {
  if (history.length === 0) return null;

  const tokens = tokenize(description);
  if (tokens.length === 0) return null;

  let best: { score: number; tx: CategorizedTx } | null = null;

  for (const tx of history) {
    const score = jaccardSimilarity(tokens, tokenize(tx.description));
    if (score < SUGGESTION_THRESHOLD) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score && tx.occurredAt > best.tx.occurredAt)
    ) {
      best = { score, tx };
    }
  }

  if (!best) return null;

  const tx = best.tx;
  return {
    categoryId: tx.categoryId,
    confidence: best.score,
    sourceDescription: tx.description,
    suggestedNormalized: tx.normalized ?? undefined,
    suggestedPerson: tx.person as SuggestionResult["suggestedPerson"],
    suggestedWallet: tx.wallet as SuggestionResult["suggestedWallet"],
    suggestedPaymentType: tx.paymentType as SuggestionResult["suggestedPaymentType"],
    suggestedTags: tx.tags,
  };
}

export async function getSuggestions(
  descriptions: string[],
  prisma: PrismaClient
): Promise<Map<string, SuggestionResult>> {
  if (descriptions.length === 0) return new Map();

  const history = await prisma.transaction.findMany({
    where: { categoryId: { not: null } },
    select: {
      description: true,
      categoryId: true,
      normalized: true,
      person: true,
      wallet: true,
      paymentType: true,
      tags: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: "desc" },
  });

  const typedHistory: CategorizedTx[] = history.map((h) => ({
    description: h.description,
    categoryId: h.categoryId!,
    normalized: h.normalized,
    person: h.person,
    wallet: h.wallet,
    paymentType: h.paymentType,
    tags: h.tags,
    occurredAt: h.occurredAt,
  }));

  const result = new Map<string, SuggestionResult>();

  for (const desc of descriptions) {
    const match = findBestMatch(desc, typedHistory);
    if (match) result.set(desc, match);
  }

  return result;
}
