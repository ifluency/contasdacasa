import type { Rule } from "@prisma/client";
import { prisma } from "@/lib/db";

export type RuleAction = {
  renameTo?: string | null;
  categoryId?: string | null;
  tags?: string[];
  person?: "PEDRO" | "MIRELA" | "AMBOS" | null;
  paymentType?: "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO" | null;
  wallet?: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS" | null;
  incomeType?: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS" | "RESTANTE_MES_ANTERIOR" | null;
};

function norm(s: string): string {
  return (s ?? "").toString().trim().toLowerCase();
}

function matches(matchType: string, pattern: string, text: string): boolean {
  const t = norm(text);
  const p = norm(pattern);

  if (!t || !p) return false;

  if (matchType === "CONTAINS") return t.includes(p);
  if (matchType === "STARTS_WITH") return t.startsWith(p);
  if (matchType === "REGEX") {
    try {
      return new RegExp(pattern, "i").test(text);
    } catch {
      return false;
    }
  }
  return false;
}

export function applyRulesFromList(rules: Rule[], description: string): RuleAction {
  for (const r of rules) {
    if (matches(r.matchType, r.pattern, description)) {
      return {
        renameTo: r.renameTo ?? null,
        categoryId: r.categoryId ?? null,
        tags: r.tags ?? [],
        person: (r.person as RuleAction["person"]) ?? null,
        paymentType: (r.paymentType as RuleAction["paymentType"]) ?? null,
        wallet: (r.wallet as RuleAction["wallet"]) ?? null,
        incomeType: (r.incomeType as RuleAction["incomeType"]) ?? null
      };
    }
  }
  return {};
}

export async function loadRules(target: "TRANSACTION" | "INCOME"): Promise<Rule[]> {
  return prisma.rule.findMany({
    where: { isActive: true, target },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
  });
}

export async function applyRules(target: "TRANSACTION" | "INCOME", description: string): Promise<RuleAction> {
  const rules = await loadRules(target);
  return applyRulesFromList(rules, description);
}

export function cleanDisplayName(desc: string): string {
  // limpeza leve (sem regras): remove prefixos comuns
  const s = (desc ?? "").trim();
  return s
    .replace(/^dm\*/i, "")
    .replace(/^pag\*/i, "")
    .replace(/^pg\s*\*/i, "")
    .replace(/^ifd\*/i, "")
    .trim();
}
