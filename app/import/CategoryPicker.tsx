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

      {/* Search results */}
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
