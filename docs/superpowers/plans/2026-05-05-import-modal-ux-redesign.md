# Import Modal UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wide 10-column table import modal with a split-view layout (compact list on the left, focused detail panel on the right) that makes transaction classification fast and clear.

**Architecture:** Extract all shared types and pure utility functions out of `page.tsx` into dedicated modules, build three focused UI components (CategoryPicker, TransactionList, DetailPanel), then rewrite the modal section of `page.tsx` to compose them. All API routes, data types, and the suggestion engine are unchanged.

**Tech Stack:** Next.js App Router, React 18, Tailwind CSS, TypeScript, Vitest (node env — only pure-function tests)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/import/types.ts` | All shared TypeScript types |
| Create | `app/import/importLogic.ts` | Pure utility + logic functions |
| Create | `app/import/importLogic.test.ts` | Unit tests for pure functions |
| Create | `app/import/CategoryPicker.tsx` | Search + group chips + suggestion box |
| Create | `app/import/TransactionList.tsx` | Left panel: filterable compact list |
| Create | `app/import/DetailPanel.tsx` | Right panel: fields + rule form + nav |
| Modify | `app/import/page.tsx` | Rewritten modal; all state management |

---

## Task 1: Extract shared types

**Files:**
- Create: `app/import/types.ts`

- [ ] **Step 1: Create types module**

```typescript
// app/import/types.ts

export type Uploader = "PEDRO" | "MIRELA";
export type Person = "PEDRO" | "MIRELA" | "AMBOS";
export type Wallet = "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
export type PaymentType = "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO" | "IGNORAR";
export type IncomeType = "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS" | "RESTANTE_MES_ANTERIOR";

export type Category = {
  id: string;
  groupName: string;
  name: string;
};

export type PreviewTx = {
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
  suggestion?: {
    categoryId: string;
    confidence: number;
    sourceDescription: string;
    suggestedNormalized?: string;
    suggestedPerson?: Person;
    suggestedWallet?: Wallet;
    suggestedPaymentType?: PaymentType;
    suggestedTags: string[];
  };
};

export type PreviewIncome = {
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

export type PreviewItem = PreviewTx | PreviewIncome;

export type RuleDraft = {
  open: boolean;
  target: "TRANSACTION" | "INCOME";
  matchType: "CONTAINS" | "STARTS_WITH" | "REGEX";
  pattern: string;
  priority: number;
  renameTo: string;
  categoryId: string;
  tags: string;
  person: "" | Person;
  paymentType: "" | PaymentType;
  wallet: "" | Wallet;
  incomeType: "" | IncomeType;
  saving?: boolean;
  error?: string;
  ok?: string;
};

export type UndoState = {
  key: string;
  description: string;
  prevCategoryId: string | null;
  categoryName: string;
};
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors from `app/import/types.ts`

- [ ] **Step 3: Commit**

```bash
git add app/import/types.ts
git commit -m "feat: extract import types to shared module"
```

---

## Task 2: Extract utility functions and add auto-advance logic

**Files:**
- Create: `app/import/importLogic.ts`
- Create: `app/import/importLogic.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// app/import/importLogic.test.ts
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
    makeTx("a", "cat-1"),  // categorized
    makeTx("b", null),      // uncategorized
    makeTx("c", null),      // uncategorized
    makeTx("d", "cat-2"),  // categorized
  ];
  const allSelected: Record<string, boolean> = { a: true, b: true, c: true, d: true };

  it("finds next uncategorized after current position", () => {
    expect(findNextUncategorized(items, "a", allSelected)).toBe("b");
  });

  it("skips categorized items", () => {
    expect(findNextUncategorized(items, "b", allSelected)).toBe("c");
  });

  it("wraps around to find uncategorized before current", () => {
    // from "c" going forward: d is categorized, a is categorized, b is uncategorized
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
    // mercado (uncategorized tx) + farmacia (uncategorized tx)
    // spotify is categorized, income is always considered classified
    expect(result).toHaveLength(2);
    expect(result.map((i) => (i as any).rowHash)).toEqual(["mercado", "farmacia"]);
  });

  it("combines text and uncategorized filter", () => {
    const result = filterItems(items, "far", true);
    expect(result).toHaveLength(1);
    expect((result[0] as any).rowHash).toBe("farmacia");
  });

  it("income items pass uncategorized filter (always shown)", () => {
    const result = filterItems([makeIncome("sal")], "", true);
    expect(result).toHaveLength(0); // incomes ARE considered categorized, so filtered out
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — `importLogic` module not found

- [ ] **Step 3: Create the logic module**

```typescript
// app/import/importLogic.ts
import type { PreviewItem, PreviewTx, RuleDraft, Person, Wallet, PaymentType, IncomeType } from "./types";

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
```

- [ ] **Step 4: Run tests and confirm they all pass**

Run: `npm test 2>&1 | tail -20`
Expected: all tests PASS (the existing tokenize/jaccard tests plus the new ones)

- [ ] **Step 5: Commit**

```bash
git add app/import/importLogic.ts app/import/importLogic.test.ts
git commit -m "feat: add importLogic module with auto-advance and filter logic (18+ tests passing)"
```

---

## Task 3: Build CategoryPicker component

**Files:**
- Create: `app/import/CategoryPicker.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/import/CategoryPicker.tsx
"use client";

import { useMemo, useState } from "react";
import type { Category } from "./types";
import { groupIcon } from "./importLogic";

type Suggestion = {
  categoryId: string;
  confidence: number;
  sourceDescription: string;
};

type Props = {
  categories: Category[];
  selectedCategoryId: string | null;
  suggestion?: Suggestion;
  onSelect: (categoryId: string | null) => void;
  onAcceptSuggestion?: () => void;
};

export function CategoryPicker({
  categories,
  selectedCategoryId,
  suggestion,
  onSelect,
  onAcceptSuggestion,
}: Props) {
  const [search, setSearch] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of categories) {
      if (!map.has(c.groupName)) map.set(c.groupName, []);
      map.get(c.groupName)!.push(c);
    }
    return map;
  }, [categories]);

  const searchResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.groupName.toLowerCase().includes(q)
    );
  }, [categories, search]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const suggestedCategory = useMemo(
    () =>
      suggestion
        ? (categories.find((c) => c.id === suggestion.categoryId) ?? null)
        : null,
    [categories, suggestion]
  );

  function toggleGroup(groupName: string) {
    setOpenGroup((prev) => (prev === groupName ? null : groupName));
  }

  return (
    <div>
      {/* AI Suggestion — shown only when no category is set yet */}
      {suggestion && suggestedCategory && !selectedCategoryId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-amber-800">💡 Sugestão automática</div>
            <div className="text-sm font-semibold text-amber-900 mt-0.5">
              {groupIcon(suggestedCategory.groupName)} {suggestedCategory.groupName} — {suggestedCategory.name}
              <span className="text-amber-600 font-normal ml-1.5">
                {Math.round(suggestion.confidence * 100)}%
              </span>
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5 truncate">
              similar a &ldquo;{suggestion.sourceDescription}&rdquo;
            </div>
          </div>
          <button
            type="button"
            onClick={onAcceptSuggestion}
            className="flex-shrink-0 bg-amber-400 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
          >
            Aceitar
          </button>
        </div>
      )}

      {/* Currently selected */}
      {selectedCategory && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
          <span className="text-sm text-green-800 font-medium">
            {groupIcon(selectedCategory.groupName)} {selectedCategory.groupName} — {selectedCategory.name}
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-green-600 hover:text-green-800 text-xs ml-2 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search input */}
      <div className="flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-2 bg-white focus-within:border-blue-400 transition-colors mb-3">
        <span className="text-zinc-400 text-sm">🔍</span>
        <input
          className="flex-1 outline-none text-sm bg-transparent"
          placeholder="Buscar categoria..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpenGroup(null);
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-zinc-400 hover:text-zinc-600 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Search results dropdown */}
      {search && (
        <div className="border border-zinc-200 rounded-lg overflow-hidden mb-3 shadow-sm">
          {searchResults.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-400">
              Nenhuma categoria encontrada.
            </div>
          )}
          {searchResults.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c.id);
                setSearch("");
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-b-0 transition-colors ${
                c.id === selectedCategoryId ? "bg-green-50 text-green-800" : ""
              }`}
            >
              <span>{groupIcon(c.groupName)}</span>
              <span className="font-medium">{c.name}</span>
              <span className="text-zinc-400 text-xs">{c.groupName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Group buttons + expanded subcategory chips */}
      {!search && (
        <div className="flex flex-col gap-1.5">
          {Array.from(groups.entries()).map(([groupName, cats]) => (
            <div key={groupName}>
              <button
                type="button"
                onClick={() => toggleGroup(groupName)}
                className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  openGroup === groupName
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                <span>{groupIcon(groupName)}</span>
                <span>{groupName}</span>
                <span className="ml-0.5 text-[10px]">
                  {openGroup === groupName ? "▴" : "▾"}
                </span>
              </button>

              {openGroup === groupName && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg">
                  {cats.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        onSelect(c.id === selectedCategoryId ? null : c.id)
                      }
                      className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                        c.id === selectedCategoryId
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-white border-zinc-200 hover:border-green-400 hover:bg-green-50 hover:text-green-700"
                      }`}
                    >
                      {c.name}
                      {c.id === selectedCategoryId && " ✓"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/import/CategoryPicker.tsx
git commit -m "feat: add CategoryPicker component (search + groups + suggestion)"
```

---

## Task 4: Build TransactionList component (left panel)

**Files:**
- Create: `app/import/TransactionList.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/import/TransactionList.tsx
"use client";

import { useMemo, useState } from "react";
import type { PreviewItem, Category } from "./types";
import { keyOf, formatBRL, filterItems, isCategorized } from "./importLogic";

type Props = {
  items: PreviewItem[];
  categories: Category[];
  selected: Record<string, boolean>;
  activeKey: string | null;
  onToggleSelect: (key: string, checked: boolean) => void;
  onToggleAll: (value: boolean) => void;
  onActivate: (key: string) => void;
};

export function TransactionList({
  items,
  categories,
  selected,
  activeKey,
  onToggleSelect,
  onToggleAll,
  onActivate,
}: Props) {
  const [filterText, setFilterText] = useState("");
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const visible = useMemo(
    () => filterItems(items, filterText, onlyUncategorized),
    [items, filterText, onlyUncategorized]
  );

  const uncategorizedCount = useMemo(
    () => items.filter((it) => !isCategorized(it)).length,
    [items]
  );

  const allVisibleSelected = visible.every((it) => selected[keyOf(it)]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="p-2.5 border-b border-zinc-100 space-y-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-zinc-50 focus-within:border-blue-300 focus-within:bg-white transition-colors">
          <span className="text-zinc-400 text-xs">🔍</span>
          <input
            className="flex-1 bg-transparent outline-none text-xs"
            placeholder="Filtrar..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText("")}
              className="text-zinc-400 text-xs"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOnlyUncategorized(false)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
              !onlyUncategorized
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white border-zinc-200 text-zinc-500"
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setOnlyUncategorized(true)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
              onlyUncategorized
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white border-zinc-200 text-zinc-500"
            }`}
          >
            Sem cat. ({uncategorizedCount})
          </button>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => onToggleAll(true)}
              className="text-[11px] underline text-zinc-500"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => onToggleAll(false)}
              className="text-[11px] underline text-zinc-500"
            >
              Nenhum
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="overflow-y-auto flex-1">
        {visible.map((it) => {
          const k = keyOf(it);
          const isActive = k === activeKey;
          const checked = !!selected[k];
          const categorized = isCategorized(it);
          const cat =
            it.kind === "transaction" && it.categoryId
              ? categoryMap.get(it.categoryId)
              : null;
          const hasSuggestion =
            it.kind === "transaction" && !!it.suggestion && !it.categoryId;
          const date = new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }).format(new Date(it.occurredAt));

          return (
            <div
              key={k}
              onClick={() => onActivate(k)}
              className={`px-3 py-2.5 border-b border-zinc-50 cursor-pointer flex items-start gap-2 transition-colors ${
                isActive
                  ? "bg-blue-50 border-l-2 border-l-blue-400"
                  : "hover:bg-zinc-50"
              } ${!checked ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelect(k, e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-zinc-900 truncate">
                  {it.description}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[10px] text-zinc-400">{date}</span>
                  {categorized && cat && (
                    <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 rounded-full px-1.5 py-0.5">
                      ✓ {cat.name}
                    </span>
                  )}
                  {!categorized && !hasSuggestion && (
                    <span className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-1.5 py-0.5">
                      sem categoria
                    </span>
                  )}
                  {hasSuggestion &&
                    it.kind === "transaction" &&
                    it.suggestion && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                        💡 {Math.round(it.suggestion.confidence * 100)}%
                      </span>
                    )}
                  {it.kind === "income" && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.5">
                      entrada
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs font-bold text-red-600 flex-shrink-0">
                {formatBRL(it.amountCents)}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="p-4 text-xs text-zinc-400 text-center">
            Nenhum item.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/import/TransactionList.tsx
git commit -m "feat: add TransactionList component (left panel)"
```

---

## Task 5: Build DetailPanel component (right panel)

**Files:**
- Create: `app/import/DetailPanel.tsx`

This component renders the right panel for the selected transaction or income. It includes: transaction header chips, CategoryPicker (for transactions), other editable fields, an expandable rule draft section (same fields as current sub-row), and navigation buttons. TagsPicker is defined locally here since it's only used in this component.

- [ ] **Step 1: Create the component**

```tsx
// app/import/DetailPanel.tsx
"use client";

import { useMemo, useState } from "react";
import type {
  PreviewItem,
  PreviewTx,
  PreviewIncome,
  Category,
  RuleDraft,
  Person,
  Wallet,
  PaymentType,
  IncomeType,
} from "./types";
import { formatBRL, sourceLabel, groupIcon, parseTags } from "./importLogic";
import { CategoryPicker } from "./CategoryPicker";

// ── TagsPicker ────────────────────────────────────────────────────────────────

function TagsPicker({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const selectedSet = useMemo(() => new Set(value), [value]);

  function toggle(tag: string) {
    const next = new Set(selectedSet);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onChange(Array.from(next));
  }

  function addNew() {
    const t = newTag.trim();
    if (!t) return;
    const next = new Set(selectedSet);
    next.add(t);
    onChange(Array.from(next));
    setNewTag("");
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="border rounded-lg px-3 py-2 text-xs w-full text-left bg-white"
        onClick={() => setOpen((v) => !v)}
      >
        {value.length ? `${value.length} tag(s): ${value.slice(0, 2).join(", ")}${value.length > 2 ? "…" : ""}` : "Selecionar tags"}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg p-3">
          <div className="text-xs font-semibold mb-2">Tags</div>
          <div className="max-h-40 overflow-y-auto pr-1 space-y-1">
            {options.map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={selectedSet.has(tag)} onChange={() => toggle(tag)} />
                <span className="break-words">{tag}</span>
              </label>
            ))}
            {options.length === 0 && (
              <div className="text-xs text-zinc-500">Sem sugestões.</div>
            )}
          </div>
          <div className="mt-3 border-t pt-3">
            <div className="text-xs font-semibold mb-2">Adicionar nova</div>
            <div className="flex gap-2">
              <input
                className="border rounded-lg p-2 text-xs w-full"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNew()}
                placeholder="Ex.: Caixinha"
              />
              <button
                type="button"
                className="border rounded-lg px-3 py-2 text-xs bg-zinc-900 text-white"
                onClick={addNew}
              >
                Add
              </button>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="text-xs underline" onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────

type Props = {
  item: PreviewItem | null;
  categories: Category[];
  tagOptions: string[];
  ruleDraft: RuleDraft | null;
  acceptedSuggestion: boolean;
  onUpdateTx: (rowHash: string, patch: Partial<PreviewTx>) => void;
  onUpdateIncome: (previewId: string, patch: Partial<PreviewIncome>) => void;
  onAcceptSuggestion: (
    rowHash: string,
    suggestion: NonNullable<PreviewTx["suggestion"]>
  ) => void;
  onAdvance: () => void;
  onSkip: () => void;
  onOpenRule: () => void;
  onCloseRule: () => void;
  onSetDraft: (patch: Partial<RuleDraft>) => void;
  onSaveRule: (applyNow: boolean) => void;
};

export function DetailPanel({
  item,
  categories,
  tagOptions,
  ruleDraft,
  acceptedSuggestion,
  onUpdateTx,
  onUpdateIncome,
  onAcceptSuggestion,
  onAdvance,
  onSkip,
  onOpenRule,
  onCloseRule,
  onSetDraft,
  onSaveRule,
}: Props) {
  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-zinc-400">
        Selecione uma transação na lista.
      </div>
    );
  }

  const dateStr = new Intl.DateTimeFormat("pt-BR").format(
    new Date(item.occurredAt)
  );
  const isTx = item.kind === "transaction";
  const tx = isTx ? (item as PreviewTx) : null;
  const income = !isTx ? (item as PreviewIncome) : null;

  // ── Chip helpers ────────────────────────────────────────────────────────────
  function chipCls(color: string) {
    return `inline-flex items-center gap-1 border rounded-full px-2.5 py-0.5 text-[11px] font-medium ${color}`;
  }

  function paymentChip(p: PaymentType) {
    if (p === "DEBITO_PIX") return chipCls("bg-blue-50 text-blue-700 border-blue-200");
    if (p === "CREDITO_A_VISTA") return chipCls("bg-purple-50 text-purple-700 border-purple-200");
    if (p === "PARCELADO") return chipCls("bg-amber-50 text-amber-800 border-amber-200");
    return chipCls("bg-zinc-100 text-zinc-600 border-zinc-200");
  }

  function paymentLabel(p: PaymentType) {
    if (p === "DEBITO_PIX") return "🔵 Débito/PIX";
    if (p === "CREDITO_A_VISTA") return "🟣 Crédito à vista";
    if (p === "PARCELADO") return "🟠 Parcelado";
    return "⚪ Ignorar";
  }

  function walletChip(w: Wallet) {
    if (w === "SALARIO") return chipCls("bg-emerald-50 text-emerald-800 border-emerald-200");
    if (w === "VALE_ALIMENTACAO") return chipCls("bg-lime-50 text-lime-800 border-lime-200");
    return chipCls("bg-zinc-100 text-zinc-600 border-zinc-200");
  }

  function walletLabel(w: Wallet) {
    if (w === "SALARIO") return "🟢 Salário";
    if (w === "VALE_ALIMENTACAO") return "🟡 Vale";
    return "⚫ Outros";
  }

  // ── Section label ───────────────────────────────────────────────────────────
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide mt-5 mb-2">
      {children}
    </div>
  );

  return (
    <div className="p-5 overflow-y-auto h-full">
      {/* Transaction header */}
      <div className="mb-1">
        <div className="text-lg font-bold text-zinc-900">{item.description}</div>
        {tx?.installmentCurrent && tx.installmentTotal && (
          <div className="text-xs text-zinc-500 mt-0.5">
            Parcela {tx.installmentCurrent}/{tx.installmentTotal}
          </div>
        )}
      </div>
      <div className="text-2xl font-extrabold text-red-600 mb-3">
        {formatBRL(item.amountCents)}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-1">
        <span className={chipCls("bg-zinc-100 text-zinc-600 border-zinc-200")}>{dateStr}</span>
        <span className={chipCls("bg-zinc-100 text-zinc-600 border-zinc-200")}>{sourceLabel(item.source)}</span>
        {tx && <span className={paymentChip(tx.paymentType)}>{paymentLabel(tx.paymentType)}</span>}
        <span className={chipCls("bg-zinc-100 text-zinc-600 border-zinc-200")}>
          {item.person === "PEDRO" ? "Pedro" : item.person === "MIRELA" ? "Mirela" : "Ambos"}
        </span>
        <span className={walletChip(item.wallet)}>{walletLabel(item.wallet)}</span>
      </div>

      {/* ── TRANSACTION fields ─────────────────────────────────────────────── */}
      {tx && (
        <>
          <SectionLabel>Categoria</SectionLabel>
          <CategoryPicker
            categories={categories}
            selectedCategoryId={tx.categoryId}
            suggestion={tx.suggestion}
            onSelect={(id) => onUpdateTx(tx.rowHash, { categoryId: id })}
            onAcceptSuggestion={() =>
              tx.suggestion && onAcceptSuggestion(tx.rowHash, tx.suggestion)
            }
          />

          <SectionLabel>Outros campos</SectionLabel>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-600">Nome de exibição</label>
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                value={tx.normalized}
                onChange={(e) => onUpdateTx(tx.rowHash, { normalized: e.target.value })}
                placeholder="Ex.: Spotify"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-600">Pessoa</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                  value={tx.person}
                  onChange={(e) =>
                    onUpdateTx(tx.rowHash, { person: e.target.value as Person })
                  }
                >
                  <option value="PEDRO">Pedro</option>
                  <option value="MIRELA">Mirela</option>
                  <option value="AMBOS">Ambos</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600">Carteira</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                  value={tx.wallet}
                  onChange={(e) =>
                    onUpdateTx(tx.rowHash, { wallet: e.target.value as Wallet })
                  }
                >
                  <option value="SALARIO">Salário</option>
                  <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                  <option value="OUTROS">Outros</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600">Tipo de pagamento</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                  value={tx.paymentType}
                  onChange={(e) =>
                    onUpdateTx(tx.rowHash, { paymentType: e.target.value as PaymentType })
                  }
                >
                  <option value="DEBITO_PIX">Débito/PIX</option>
                  <option value="CREDITO_A_VISTA">Crédito à vista</option>
                  <option value="PARCELADO">Parcelado</option>
                  <option value="IGNORAR">Ignorar</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600">Tags</label>
                <div className="mt-1">
                  <TagsPicker
                    value={tx.tags ?? []}
                    options={tagOptions}
                    onChange={(next) => onUpdateTx(tx.rowHash, { tags: next })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-600">Notas</label>
              <textarea
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
                value={tx.notes ?? ""}
                onChange={(e) => onUpdateTx(tx.rowHash, { notes: e.target.value })}
                placeholder="Observações..."
              />
            </div>
          </div>

          {/* Secondary actions */}
          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={ruleDraft?.open ? onCloseRule : onOpenRule}
            >
              {ruleDraft?.open ? "▲ Fechar regra" : "➕ Criar regra para futuras importações"}
            </button>
            <button
              type="button"
              className="text-xs text-emerald-700 hover:underline"
              onClick={() => {
                const nextTags = new Set([...(tx.tags ?? []), "Fixa Dividida"]);
                onUpdateTx(tx.rowHash, {
                  person: "AMBOS",
                  tags: Array.from(nextTags),
                });
              }}
            >
              ⇄ Dividir 50/50
            </button>
          </div>

          {acceptedSuggestion && tx.suggestion && !ruleDraft?.open && (
            <button
              type="button"
              className="mt-1 text-xs text-blue-600 hover:underline"
              onClick={onOpenRule}
            >
              Criar regra para futuras importações →
            </button>
          )}
        </>
      )}

      {/* ── INCOME fields ──────────────────────────────────────────────────── */}
      {income && (
        <>
          <SectionLabel>Campos</SectionLabel>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-600">Pessoa</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                  value={income.person}
                  onChange={(e) =>
                    onUpdateIncome(income.previewId, { person: e.target.value as Person })
                  }
                >
                  <option value="PEDRO">Pedro</option>
                  <option value="MIRELA">Mirela</option>
                  <option value="AMBOS">Ambos</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600">Carteira</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                  value={income.wallet}
                  onChange={(e) =>
                    onUpdateIncome(income.previewId, { wallet: e.target.value as Wallet })
                  }
                >
                  <option value="SALARIO">Salário</option>
                  <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                  <option value="OUTROS">Outros</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600">Tipo de entrada</label>
              <select
                className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                value={income.incomeType}
                onChange={(e) =>
                  onUpdateIncome(income.previewId, {
                    incomeType: e.target.value as IncomeType,
                  })
                }
              >
                <option value="SALARIO">Salário</option>
                <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                <option value="OUTROS">Outros</option>
                <option value="RESTANTE_MES_ANTERIOR">Restante Mês Anterior</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600">Notas</label>
              <textarea
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
                value={income.notes ?? ""}
                onChange={(e) =>
                  onUpdateIncome(income.previewId, { notes: e.target.value })
                }
                placeholder="Observações..."
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100">
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={ruleDraft?.open ? onCloseRule : onOpenRule}
            >
              {ruleDraft?.open ? "▲ Fechar regra" : "➕ Criar regra para futuras importações"}
            </button>
          </div>
        </>
      )}

      {/* ── Rule draft section (expandable) ───────────────────────────────── */}
      {ruleDraft?.open && (
        <div className="mt-4 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Criar regra (para próximos imports)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium">Alvo</label>
              <select
                className="mt-1 w-full border rounded-lg p-2 text-xs"
                value={ruleDraft.target}
                onChange={(e) => onSetDraft({ target: e.target.value as "TRANSACTION" | "INCOME" })}
              >
                <option value="TRANSACTION">Transação</option>
                <option value="INCOME">Entrada</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Match</label>
              <select
                className="mt-1 w-full border rounded-lg p-2 text-xs"
                value={ruleDraft.matchType}
                onChange={(e) => onSetDraft({ matchType: e.target.value as "CONTAINS" | "STARTS_WITH" | "REGEX" })}
              >
                <option value="CONTAINS">Contém</option>
                <option value="STARTS_WITH">Começa com</option>
                <option value="REGEX">Regex</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Prioridade</label>
              <input
                className="mt-1 w-full border rounded-lg p-2 text-xs"
                type="number"
                value={ruleDraft.priority}
                onChange={(e) => onSetDraft({ priority: Number(e.target.value) })}
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-medium">Padrão (pattern)</label>
              <input
                className="mt-1 w-full border rounded-lg p-2 text-xs"
                value={ruleDraft.pattern}
                onChange={(e) => onSetDraft({ pattern: e.target.value })}
              />
              <div className="text-[11px] text-zinc-500 mt-1">
                Use um trecho estável (não precisa colar tudo).
              </div>
            </div>
            {ruleDraft.target === "TRANSACTION" ? (
              <>
                <div>
                  <label className="text-xs font-medium">Renomear para</label>
                  <input
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.renameTo}
                    onChange={(e) => onSetDraft({ renameTo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Categoria</label>
                  <select
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.categoryId}
                    onChange={(e) => onSetDraft({ categoryId: e.target.value })}
                  >
                    <option value="">(nenhuma)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {groupIcon(c.groupName)} {c.groupName} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Tags</label>
                  <input
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.tags}
                    onChange={(e) => onSetDraft({ tags: e.target.value })}
                    placeholder="Separadas por vírgula"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Pessoa</label>
                  <select
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.person}
                    onChange={(e) => onSetDraft({ person: e.target.value as "" | Person })}
                  >
                    <option value="">(não setar)</option>
                    <option value="PEDRO">Pedro</option>
                    <option value="MIRELA">Mirela</option>
                    <option value="AMBOS">Ambos</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Tipo</label>
                  <select
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.paymentType}
                    onChange={(e) => onSetDraft({ paymentType: e.target.value as "" | PaymentType })}
                  >
                    <option value="">(não setar)</option>
                    <option value="DEBITO_PIX">Débito/PIX</option>
                    <option value="CREDITO_A_VISTA">Crédito à vista</option>
                    <option value="PARCELADO">Parcelado</option>
                    <option value="IGNORAR">Ignorar</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Carteira</label>
                  <select
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.wallet}
                    onChange={(e) => onSetDraft({ wallet: e.target.value as "" | Wallet })}
                  >
                    <option value="">(não setar)</option>
                    <option value="SALARIO">Salário</option>
                    <option value="VALE_ALIMENTACAO">Vale</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs font-medium">Tipo de entrada</label>
                <select
                  className="mt-1 w-full border rounded-lg p-2 text-xs"
                  value={ruleDraft.incomeType}
                  onChange={(e) => onSetDraft({ incomeType: e.target.value as "" | IncomeType })}
                >
                  <option value="">(obrigatório)</option>
                  <option value="SALARIO">Salário</option>
                  <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                  <option value="OUTROS">Outros</option>
                  <option value="RESTANTE_MES_ANTERIOR">Restante Mês Anterior</option>
                </select>
              </div>
            )}
          </div>

          {(ruleDraft.error || ruleDraft.ok) && (
            <div
              className={`mt-3 text-sm border rounded-lg p-3 ${
                ruleDraft.error
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}
            >
              {ruleDraft.error ?? ruleDraft.ok}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="border rounded-lg px-4 py-2 bg-zinc-900 text-white text-sm disabled:opacity-50"
              onClick={() => onSaveRule(false)}
              disabled={!!ruleDraft.saving}
            >
              {ruleDraft.saving ? "Salvando..." : "Salvar regra"}
            </button>
            <button
              className="border rounded-lg px-4 py-2 bg-white text-sm disabled:opacity-50"
              onClick={() => onSaveRule(true)}
              disabled={!!ruleDraft.saving}
            >
              {ruleDraft.saving ? "Salvando..." : "Salvar e aplicar nesta linha"}
            </button>
            <button
              className="border rounded-lg px-4 py-2 bg-white text-sm"
              onClick={onCloseRule}
              disabled={!!ruleDraft.saving}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          Pular →
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="flex-1 bg-zinc-900 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-zinc-800"
        >
          Classificar e avançar →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/import/DetailPanel.tsx
git commit -m "feat: add DetailPanel component (right panel with CategoryPicker + rule form)"
```

---

## Task 6: Rewrite page.tsx — split view modal

**Files:**
- Modify: `app/import/page.tsx`

Replace the entire file with the split-view implementation. The upload form (top section) is unchanged. All API calls (`preview`, `commit`) and their logic are unchanged. The modal replaces the table with TransactionList + DetailPanel.

- [ ] **Step 1: Rewrite page.tsx**

```tsx
// app/import/page.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import type {
  Uploader,
  Person,
  Wallet,
  PaymentType,
  Category,
  PreviewTx,
  PreviewIncome,
  PreviewItem,
  RuleDraft,
  UndoState,
} from "./types";
import {
  keyOf,
  formatBRL,
  parseTags,
  defaultDraftForItem,
  draftFromSuggestion,
  findNextUncategorized,
} from "./importLogic";
import { TransactionList } from "./TransactionList";
import { DetailPanel } from "./DetailPanel";

export default function ImportPage() {
  // ── Upload state ──────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [uploader, setUploader] = useState<Uploader>("MIRELA");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, RuleDraft>>({});
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(new Set());

  // ── Navigation state ──────────────────────────────────────────────────────
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stores the categoryId when the user first opens an item, for undo
  const preEditCategoryIdRef = useRef<string | null>(null);

  // ── Derived values ────────────────────────────────────────────────────────
  const totalSelected = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const uncategorizedCount = useMemo(
    () =>
      items.filter(
        (it) =>
          it.kind === "transaction" &&
          (!it.categoryId || it.categoryId === "")
      ).length,
    [items]
  );

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) {
      set.add(`${c.groupName} - ${c.name}`);
      set.add(c.groupName);
    }
    set.add("Fixa Dividida");
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const activeItem = useMemo(
    () => (activeKey ? items.find((it) => keyOf(it) === activeKey) ?? null : null),
    [activeKey, items]
  );

  // ── API: preview ──────────────────────────────────────────────────────────
  async function preview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setStatus("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("uploader", uploader);
      const res = await fetch("/api/import/nubank/preview", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!json.ok) {
        setStatus(json.error ?? "Erro ao gerar prévia.");
        return;
      }
      const loadedItems: PreviewItem[] = json.items ?? [];
      setCategories(json.categories ?? []);
      setItems(loadedItems);

      const sel: Record<string, boolean> = {};
      const drafts: Record<string, RuleDraft> = {};
      for (const it of loadedItems) {
        const k = keyOf(it);
        sel[k] = true;
        drafts[k] = defaultDraftForItem(it);
      }
      setSelected(sel);
      setRuleDrafts(drafts);
      setAcceptedSuggestions(new Set());

      // Auto-select first uncategorized transaction
      const firstUncategorized = loadedItems.find(
        (it) => it.kind === "transaction" && !it.categoryId
      );
      const firstKey = firstUncategorized
        ? keyOf(firstUncategorized)
        : loadedItems[0]
        ? keyOf(loadedItems[0])
        : null;
      setActiveKey(firstKey);
      if (firstUncategorized?.kind === "transaction") {
        preEditCategoryIdRef.current = firstUncategorized.categoryId;
      }

      setModalOpen(true);
      setStatus("");
    } catch (err: any) {
      setStatus(err?.message ?? "Falha ao gerar prévia.");
    } finally {
      setLoading(false);
    }
  }

  // ── API: commit ───────────────────────────────────────────────────────────
  async function commit() {
    setLoading(true);
    setStatus("");
    try {
      const payloadItems = items.filter((it) => selected[keyOf(it)]);
      const res = await fetch("/api/import/nubank/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: payloadItems }),
      });
      const json = await res.json();
      if (!json.ok) {
        setStatus(json.error ?? "Erro ao importar.");
        return;
      }
      setStatus(
        `Importação concluída ✅ Transações: +${json.insertedTx} (skip ${json.skippedTx}) | Entradas: +${json.insertedIncome} (skip ${json.skippedIncome})`
      );
      setModalOpen(false);
      setItems([]);
      setSelected({});
      setRuleDrafts({});
      setActiveKey(null);
    } catch (err: any) {
      setStatus(err?.message ?? "Falha ao importar.");
    } finally {
      setLoading(false);
    }
  }

  // ── Item mutators ─────────────────────────────────────────────────────────
  function setTx(rowHash: string, patch: Partial<PreviewTx>) {
    setItems((prev) =>
      prev.map((it) =>
        it.kind === "transaction" && it.rowHash === rowHash
          ? ({ ...it, ...patch } as PreviewTx)
          : it
      )
    );
  }

  function setIncome(previewId: string, patch: Partial<PreviewIncome>) {
    setItems((prev) =>
      prev.map((it) =>
        it.kind === "income" && it.previewId === previewId
          ? ({ ...it, ...patch } as PreviewIncome)
          : it
      )
    );
  }

  function toggleAll(v: boolean) {
    const sel: Record<string, boolean> = {};
    for (const it of items) sel[keyOf(it)] = v;
    setSelected(sel);
  }

  // ── Suggestion acceptance ─────────────────────────────────────────────────
  function acceptSuggestion(
    rowHash: string,
    s: NonNullable<PreviewTx["suggestion"]>
  ) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.kind !== "transaction" || it.rowHash !== rowHash) return it;
        return {
          ...it,
          categoryId: s.categoryId,
          normalized: s.suggestedNormalized ?? it.normalized,
          person: s.suggestedPerson ?? it.person,
          wallet: s.suggestedWallet ?? it.wallet,
          paymentType: s.suggestedPaymentType ?? it.paymentType,
          tags: s.suggestedTags.length ? s.suggestedTags : it.tags,
        };
      })
    );
    setAcceptedSuggestions((prev) => new Set([...prev, rowHash]));
  }

  // ── Navigation: activate an item in the panel ─────────────────────────────
  function handleActivate(key: string) {
    const it = items.find((i) => keyOf(i) === key);
    preEditCategoryIdRef.current =
      it?.kind === "transaction" ? it.categoryId : null;
    setActiveKey(key);
  }

  // ── Navigation: classify and advance ─────────────────────────────────────
  function handleAdvance() {
    if (!activeKey) return;
    const it = items.find((i) => keyOf(i) === activeKey);
    if (!it) return;

    // Record undo
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const cat =
      it.kind === "transaction" && it.categoryId
        ? categories.find((c) => c.id === it.categoryId)
        : null;
    setUndoState({
      key: activeKey,
      description: it.description,
      prevCategoryId: preEditCategoryIdRef.current,
      categoryName: cat?.name ?? "sem categoria",
    });
    undoTimerRef.current = setTimeout(() => setUndoState(null), 3000);

    // Advance
    const nextKey = findNextUncategorized(items, activeKey, selected);
    if (nextKey) {
      const nextItem = items.find((i) => keyOf(i) === nextKey);
      preEditCategoryIdRef.current =
        nextItem?.kind === "transaction" ? nextItem.categoryId : null;
      setActiveKey(nextKey);
    }
    // If no next uncategorized, stay on current item (all done)
  }

  // ── Navigation: skip ──────────────────────────────────────────────────────
  function handleSkip() {
    if (!activeKey) return;
    const nextKey = findNextUncategorized(items, activeKey, selected);
    if (nextKey) {
      const nextItem = items.find((i) => keyOf(i) === nextKey);
      preEditCategoryIdRef.current =
        nextItem?.kind === "transaction" ? nextItem.categoryId : null;
      setActiveKey(nextKey);
    }
  }

  // ── Undo ──────────────────────────────────────────────────────────────────
  function handleUndo() {
    if (!undoState) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    // Revert category to pre-classification state
    setItems((prev) =>
      prev.map((it) => {
        if (keyOf(it) !== undoState.key || it.kind !== "transaction") return it;
        return { ...it, categoryId: undoState.prevCategoryId };
      })
    );
    preEditCategoryIdRef.current = undoState.prevCategoryId;
    setActiveKey(undoState.key);
    setUndoState(null);
  }

  // ── Rule draft helpers ────────────────────────────────────────────────────
  function openRule(k: string) {
    setRuleDrafts((d) => ({
      ...d,
      [k]: { ...(d[k] ?? defaultDraftForItem(items.find((it) => keyOf(it) === k)!)), open: true, error: "", ok: "" },
    }));
  }
  function closeRule(k: string) {
    setRuleDrafts((d) => ({ ...d, [k]: { ...d[k], open: false } }));
  }
  function setDraft(k: string, patch: Partial<RuleDraft>) {
    setRuleDrafts((d) => ({ ...d, [k]: { ...d[k], ...patch } }));
  }

  function applyDraftToThisLine(k: string) {
    const d = ruleDrafts[k];
    if (!d) return;
    setItems((prev) =>
      prev.map((it) => {
        if (keyOf(it) !== k) return it;
        if (it.kind === "transaction" && d.target === "TRANSACTION") {
          const patch: Partial<PreviewTx> = {};
          if (d.renameTo.trim()) patch.normalized = d.renameTo.trim();
          if (d.categoryId) patch.categoryId = d.categoryId;
          const tags = parseTags(d.tags);
          if (tags.length) patch.tags = tags;
          if (d.person) patch.person = d.person as Person;
          if (d.wallet) patch.wallet = d.wallet as Wallet;
          if (d.paymentType) patch.paymentType = d.paymentType as PaymentType;
          return { ...it, ...patch } as PreviewTx;
        }
        if (it.kind === "income" && d.target === "INCOME") {
          const patch: Partial<PreviewIncome> = {};
          if (d.person) patch.person = d.person as Person;
          if (d.wallet) patch.wallet = d.wallet as Wallet;
          if (d.incomeType) patch.incomeType = d.incomeType as any;
          return { ...it, ...patch } as PreviewIncome;
        }
        return it;
      })
    );
  }

  async function saveRule(k: string, applyNow: boolean) {
    const d = ruleDrafts[k];
    if (!d) return;
    setDraft(k, { saving: true, error: "", ok: "" });
    try {
      const payload: any = {
        target: d.target,
        matchType: d.matchType,
        pattern: d.pattern.trim(),
        priority: Number(d.priority),
      };
      if (!payload.pattern) {
        setDraft(k, { saving: false, error: "Padrão (pattern) é obrigatório." });
        return;
      }
      if (d.renameTo.trim()) payload.renameTo = d.renameTo.trim();
      if (d.categoryId) payload.categoryId = d.categoryId;
      payload.tags = parseTags(d.tags);
      if (d.person) payload.person = d.person;
      if (d.wallet) payload.wallet = d.wallet;
      if (d.paymentType) payload.paymentType = d.paymentType;
      if (d.target === "INCOME") {
        if (!d.incomeType) {
          setDraft(k, { saving: false, error: "Selecione incomeType para regras de INCOME." });
          return;
        }
        payload.incomeType = d.incomeType;
      }
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setDraft(k, { saving: false, error: json.error ?? "Erro ao criar regra." });
        return;
      }
      if (applyNow) {
        applyDraftToThisLine(k);
        setDraft(k, { saving: false, ok: "Regra criada ✅ e aplicada nesta linha (prévia)." });
      } else {
        setDraft(k, { saving: false, ok: "Regra criada ✅ (vale para próximos imports)." });
      }
    } catch (err: any) {
      setDraft(k, { saving: false, error: err?.message ?? "Erro ao criar regra." });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="space-y-6">
      {/* Upload form */}
      <section className="bg-white rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Importar CSV (Nubank)</h2>
        <p className="text-sm text-zinc-600 mt-1">
          Ao enviar, abrimos uma prévia com regras e você ajusta antes de gravar no banco.
        </p>
        <form className="mt-4 space-y-4" onSubmit={preview}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Quem está fazendo o upload?</label>
              <select
                className="mt-1 w-full border rounded-lg p-2"
                value={uploader}
                onChange={(e) => setUploader(e.target.value as Uploader)}
              >
                <option value="PEDRO">Pedro</option>
                <option value="MIRELA">Mirela</option>
              </select>
              <div className="text-xs text-zinc-500 mt-1">
                Esse nome vira o padrão do campo <b>Pessoa</b> (se a regra não definir outra).
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Arquivo CSV</label>
              <input
                className="mt-1 w-full border rounded-lg p-2 bg-white"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <button
            disabled={!file || loading}
            className="border rounded-lg px-4 py-2 bg-zinc-900 text-white disabled:opacity-50"
          >
            {loading ? "Processando..." : "Gerar prévia"}
          </button>
          {status && (
            <div className="text-sm border rounded-lg p-3 bg-zinc-50">{status}</div>
          )}
        </form>
        <div className="mt-4 text-sm">
          <a className="underline" href="/manual">
            Adicionar manualmente (sem CSV)
          </a>
        </div>
      </section>

      {/* Split-view modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !loading && setModalOpen(false)}
          />
          <div className="absolute inset-0 p-3 md:p-6 flex items-center justify-center">
            <div className="w-[95vw] max-w-[1200px] h-[90vh] bg-white rounded-2xl border shadow-xl overflow-hidden flex flex-col">

              {/* Modal header */}
              <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                <div>
                  <div className="text-lg font-semibold">Prévia da importação</div>
                  <div className="text-sm text-zinc-500">
                    Sem categoria: <span className="font-semibold">{uncategorizedCount}</span> de{" "}
                    <span className="font-semibold">{items.length}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm text-zinc-700 border rounded-lg px-3 py-2 bg-zinc-50">
                    Selecionados: <span className="font-semibold">{totalSelected}</span>
                  </div>
                  <button
                    className="border rounded-lg px-4 py-2 bg-zinc-900 text-white disabled:opacity-50"
                    onClick={commit}
                    disabled={loading || totalSelected === 0}
                  >
                    {loading ? "Importando..." : "Confirmar importação ✓"}
                  </button>
                  <button
                    className="border rounded-lg px-4 py-2 bg-white"
                    onClick={() => setModalOpen(false)}
                    disabled={loading}
                  >
                    Fechar
                  </button>
                </div>
              </div>

              {/* Split body */}
              <div className="flex flex-1 overflow-hidden">
                {/* Left: transaction list */}
                <div className="w-[320px] flex-shrink-0 border-r overflow-hidden">
                  <TransactionList
                    items={items}
                    categories={categories}
                    selected={selected}
                    activeKey={activeKey}
                    onToggleSelect={(key, checked) =>
                      setSelected((s) => ({ ...s, [key]: checked }))
                    }
                    onToggleAll={toggleAll}
                    onActivate={handleActivate}
                  />
                </div>

                {/* Right: detail panel */}
                <div className="flex-1 overflow-hidden">
                  <DetailPanel
                    item={activeItem}
                    categories={categories}
                    tagOptions={tagOptions}
                    ruleDraft={activeKey ? ruleDrafts[activeKey] ?? null : null}
                    acceptedSuggestion={
                      activeItem?.kind === "transaction"
                        ? acceptedSuggestions.has(activeItem.rowHash)
                        : false
                    }
                    onUpdateTx={setTx}
                    onUpdateIncome={setIncome}
                    onAcceptSuggestion={(rowHash, suggestion) => {
                      acceptSuggestion(rowHash, suggestion);
                      // Pre-fill rule draft from suggestion
                      const it = items.find(
                        (i) => i.kind === "transaction" && (i as PreviewTx).rowHash === rowHash
                      ) as PreviewTx | undefined;
                      if (it) {
                        setRuleDrafts((prev) => ({
                          ...prev,
                          [rowHash]: draftFromSuggestion(it, suggestion),
                        }));
                      }
                    }}
                    onAdvance={handleAdvance}
                    onSkip={handleSkip}
                    onOpenRule={() => activeKey && openRule(activeKey)}
                    onCloseRule={() => activeKey && closeRule(activeKey)}
                    onSetDraft={(patch) => activeKey && setDraft(activeKey, patch)}
                    onSaveRule={(applyNow) => activeKey && saveRule(activeKey, applyNow)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Undo toast */}
          {undoState && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-zinc-900 text-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl text-sm">
              <span>
                <span className="font-semibold">{undoState.description}</span> → {undoState.categoryName}
              </span>
              <button
                onClick={handleUndo}
                className="border border-white/30 rounded-lg px-3 py-1 text-xs hover:bg-white/10"
              >
                Desfazer
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 3: Run all tests**

Run: `npm test 2>&1 | tail -15`
Expected: all tests PASS

- [ ] **Step 4: Manual browser test**

Start the dev server: `npm run dev`

Test the golden path:
1. Upload a real Nubank CSV
2. Modal opens — left list shows all items with badges
3. First uncategorized item is auto-selected in the right panel
4. AI suggestion box appears (if suggestion exists) — click "Aceitar" and verify category fills in
5. Search for a category by text — results appear, select one
6. Click a group button — subcategory chips expand, select one
7. Click "Classificar e avançar →" — panel advances to next uncategorized, undo toast appears
8. Click "Desfazer" — previous item's category reverts, panel goes back
9. Filter "Sem categoria" in the list — only uncategorized rows appear
10. Uncheck a row via checkbox — row dims, stays excluded from import
11. Click "Criar regra" — rule form expands at bottom of panel
12. Click "Dividir 50/50" — Pessoa becomes Ambos, tag "Fixa Dividida" added
13. Click "Confirmar importação ✓" — import completes, success message shown

- [ ] **Step 5: Commit**

```bash
git add app/import/page.tsx
git commit -m "feat: rewrite import modal as split view (list + detail panel)"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Left panel with compact list, status badges, filter, checkboxes
- ✅ Right panel with CategoryPicker (search + suggestion + group chips)
- ✅ Auto-advance on "Classificar e avançar →"
- ✅ Undo toast with 3s timer and revert
- ✅ "Criar regra" as expandable section in detail panel
- ✅ "Dividir 50/50" as link in detail panel
- ✅ Header with progress count + Confirmar/Fechar
- ✅ All data types unchanged
- ✅ All API routes unchanged

**No placeholders:** None found.

**Type consistency:**
- `keyOf`, `parseTags`, `draftFromSuggestion`, `defaultDraftForItem` defined in Task 2, used in Tasks 5-6 ✅
- `CategoryPicker` defined in Task 3, imported in Task 5 ✅
- `TransactionList` defined in Task 4, imported in Task 6 ✅
- `DetailPanel` defined in Task 5, imported in Task 6 ✅
- `UndoState` type defined in Task 1, used in Task 6 ✅
