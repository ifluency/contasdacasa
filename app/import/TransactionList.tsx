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
