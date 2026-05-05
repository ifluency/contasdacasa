import { describe, it, expect } from "vitest";
import { isCategorized, findNextUncategorized, filterItems } from "./importLogic";
import type { PreviewItem } from "./types";

function makeTx(rowHash: string, categoryId: string | null): PreviewItem {
  return {
    kind: "transaction",
    rowHash,
    source: "nubank_credit",
    externalId: null,
    occurredAt: "2026-05-01T00:00:00.000Z",
    monthKey: "2026-05",
    description: `Compra ${rowHash}`,
    normalized: rowHash,
    amountCents: 1000,
    person: "MIRELA",
    wallet: "SALARIO",
    paymentType: "CREDITO_A_VISTA",
    categoryId,
    tags: [],
    installmentCurrent: null,
    installmentTotal: null,
    notes: null,
  };
}

function makeIncome(previewId: string): PreviewItem {
  return {
    kind: "income",
    previewId,
    source: "nubank_debit",
    externalId: null,
    occurredAt: "2026-05-01T00:00:00.000Z",
    monthKey: "2026-05",
    description: "Salário",
    amountCents: 500000,
    person: "MIRELA",
    wallet: "SALARIO",
    incomeType: "SALARIO",
    notes: null,
  };
}

describe("isCategorized", () => {
  it("returns false for transaction without category", () => {
    expect(isCategorized(makeTx("a", null))).toBe(false);
  });

  it("returns false for transaction with empty string category", () => {
    expect(isCategorized(makeTx("a", ""))).toBe(false);
  });

  it("returns true for transaction with a category", () => {
    expect(isCategorized(makeTx("a", "cat-1"))).toBe(true);
  });

  it("returns true for income items (no category concept)", () => {
    expect(isCategorized(makeIncome("inc-1"))).toBe(true);
  });
});

describe("findNextUncategorized", () => {
  const items = [
    makeTx("a", "cat-1"),
    makeTx("b", null),
    makeTx("c", null),
    makeTx("d", "cat-2"),
  ];
  const allSelected: Record<string, boolean> = { a: true, b: true, c: true, d: true };

  it("finds next uncategorized after current position", () => {
    expect(findNextUncategorized(items, "a", allSelected)).toBe("b");
  });

  it("skips categorized items", () => {
    expect(findNextUncategorized(items, "b", allSelected)).toBe("c");
  });

  it("wraps around to find uncategorized before current", () => {
    expect(findNextUncategorized(items, "c", allSelected)).toBe("b");
  });

  it("returns null when no uncategorized items remain", () => {
    const allCat = [makeTx("a", "cat-1"), makeTx("b", "cat-2")];
    expect(findNextUncategorized(allCat, "a", { a: true, b: true })).toBeNull();
  });

  it("skips unselected items", () => {
    const sel = { a: true, b: false, c: true, d: true };
    expect(findNextUncategorized(items, "a", sel)).toBe("c");
  });

  it("returns null when only uncategorized item is the current one", () => {
    const single = [makeTx("a", "cat-1"), makeTx("b", null)];
    expect(findNextUncategorized(single, "b", { a: true, b: true })).toBeNull();
  });
});

describe("filterItems", () => {
  const items = [
    makeTx("mercado", null),
    makeTx("spotify", "cat-1"),
    makeTx("farmacia", null),
    makeIncome("salario"),
  ];

  it("returns all items when no filter applied", () => {
    expect(filterItems(items, "", false)).toHaveLength(4);
  });

  it("filters by description text (case-insensitive)", () => {
    const result = filterItems(items, "MERC", false);
    expect(result).toHaveLength(1);
    expect((result[0] as any).rowHash).toBe("mercado");
  });

  it("filters by uncategorized transactions only", () => {
    const result = filterItems(items, "", true);
    expect(result).toHaveLength(2);
    expect(result.map((i) => (i as any).rowHash)).toEqual(["mercado", "farmacia"]);
  });

  it("combines text and uncategorized filter", () => {
    const result = filterItems(items, "far", true);
    expect(result).toHaveLength(1);
    expect((result[0] as any).rowHash).toBe("farmacia");
  });

  it("income items are excluded from uncategorized filter", () => {
    const result = filterItems([makeIncome("sal")], "", true);
    expect(result).toHaveLength(0);
  });
});
