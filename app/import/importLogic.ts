import type { PreviewItem, PreviewTx, RuleDraft, Person, Wallet, PaymentType } from "./types";

export function keyOf(it: PreviewItem): string {
  return it.kind === "transaction" ? it.rowHash : it.previewId;
}

export function isCategorized(it: PreviewItem): boolean {
  if (it.kind === "income") return true;
  return it.categoryId !== null && it.categoryId !== "";
}

export function findNextUncategorized(
  items: PreviewItem[],
  currentKey: string,
  selected: Record<string, boolean>
): string | null {
  const currentIndex = items.findIndex((it) => keyOf(it) === currentKey);
  const rest = [
    ...items.slice(currentIndex + 1),
    ...items.slice(0, currentIndex),
  ];
  const next = rest.find((it) => selected[keyOf(it)] && !isCategorized(it));
  return next ? keyOf(next) : null;
}

export function filterItems(
  items: PreviewItem[],
  filterText: string,
  onlyUncategorized: boolean
): PreviewItem[] {
  const lower = filterText.toLowerCase().trim();
  return items.filter((it) => {
    if (lower && !it.description.toLowerCase().includes(lower)) return false;
    if (onlyUncategorized && isCategorized(it)) return false;
    return true;
  });
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function sourceLabel(source: string): string {
  return source === "nubank_credit" ? "Fatura Cartão de Crédito" : "Cartão de Débito/PIX";
}

export function groupIcon(groupName: string): string {
  const g = (groupName ?? "").toLowerCase();
  if (g.includes("fixa")) return "🏠";
  if (g.includes("alimenta")) return "🍽️";
  if (g.includes("transpor")) return "🚗";
  if (g.includes("saúde") || g.includes("saude")) return "🩺";
  if (g.includes("educ")) return "🎓";
  if (g.includes("lazer")) return "🎬";
  if (g.includes("casa")) return "🛋️";
  if (g.includes("pesso")) return "👤";
  if (g.includes("invest")) return "💰";
  return "🏷️";
}

export function parseTags(s: string): string[] {
  return (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function tokenizeSimple(desc: string): string[] {
  const NOISE = new Set(["pix", "pag", "dm", "ifd", "pg"]);
  return desc
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[\s*/\-.]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 3)
    .filter((t) => !/^\d{6,}$/.test(t))
    .filter((t) => !NOISE.has(t));
}

export function draftFromSuggestion(
  it: PreviewTx,
  s: NonNullable<PreviewTx["suggestion"]>
): RuleDraft {
  const newTokens = tokenizeSimple(it.description);
  const srcTokens = tokenizeSimple(s.sourceDescription);
  const shared = newTokens.filter((t) => srcTokens.includes(t));
  const pattern = shared.length > 0 ? shared[0] : it.description.slice(0, 40).trim();
  return {
    open: true,
    target: "TRANSACTION",
    matchType: "CONTAINS",
    pattern,
    priority: 20,
    renameTo: s.suggestedNormalized ?? it.normalized,
    categoryId: s.categoryId,
    tags: (s.suggestedTags ?? []).join(", "),
    person: s.suggestedPerson ?? it.person,
    paymentType: s.suggestedPaymentType ?? it.paymentType,
    wallet: s.suggestedWallet ?? it.wallet,
    incomeType: "",
  };
}

export function defaultDraftForItem(it: PreviewItem): RuleDraft {
  const basePattern = it.description.trim().slice(0, 80);
  if (it.kind === "income") {
    return {
      open: false,
      target: "INCOME",
      matchType: "CONTAINS",
      pattern: basePattern,
      priority: 20,
      renameTo: "",
      categoryId: "",
      tags: "",
      person: it.person,
      paymentType: "",
      wallet: it.wallet,
      incomeType: it.incomeType,
    };
  }
  return {
    open: false,
    target: "TRANSACTION",
    matchType: "CONTAINS",
    pattern: basePattern,
    priority: 20,
    renameTo: it.normalized ?? "",
    categoryId: it.categoryId ?? "",
    tags: (it.tags ?? []).join(", "),
    person: it.person,
    paymentType: it.paymentType,
    wallet: it.wallet,
    incomeType: "",
  };
}
