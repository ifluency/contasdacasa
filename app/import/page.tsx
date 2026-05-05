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
  parseTags,
  defaultDraftForItem,
  draftFromSuggestion,
  findNextUncategorized,
  isCategorized,
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
  const preEditCategoryIdRef = useRef<string | null>(null);

  // ── Derived values ────────────────────────────────────────────────────────
  const totalSelected = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const uncategorizedCount = useMemo(
    () => items.filter((it) => !isCategorized(it)).length,
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
    () => (activeKey ? (items.find((it) => keyOf(it) === activeKey) ?? null) : null),
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

  // ── Navigation ────────────────────────────────────────────────────────────
  function handleActivate(key: string) {
    const it = items.find((i) => keyOf(i) === key);
    preEditCategoryIdRef.current =
      it?.kind === "transaction" ? it.categoryId : null;
    setActiveKey(key);
  }

  function handleAdvance() {
    if (!activeKey) return;
    const it = items.find((i) => keyOf(i) === activeKey);
    if (!it) return;

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

    const nextKey = findNextUncategorized(items, activeKey, selected);
    if (nextKey) {
      const nextItem = items.find((i) => keyOf(i) === nextKey);
      preEditCategoryIdRef.current =
        nextItem?.kind === "transaction" ? nextItem.categoryId : null;
      setActiveKey(nextKey);
    }
  }

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

  function handleUndo() {
    if (!undoState) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
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
    const it = items.find((i) => keyOf(i) === k);
    if (!it) return;
    setRuleDrafts((d) => ({
      ...d,
      [k]: { ...(d[k] ?? defaultDraftForItem(it)), open: true, error: "", ok: "" },
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
          setDraft(k, {
            saving: false,
            error: "Selecione incomeType para regras de INCOME.",
          });
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

  // ── Render ────────────────────────────────────────────────────────────────
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
                    Sem categoria:{" "}
                    <span className="font-semibold">{uncategorizedCount}</span> de{" "}
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
                    ruleDraft={activeKey ? (ruleDrafts[activeKey] ?? null) : null}
                    acceptedSuggestion={
                      activeItem?.kind === "transaction"
                        ? acceptedSuggestions.has(activeItem.rowHash)
                        : false
                    }
                    onUpdateTx={setTx}
                    onUpdateIncome={setIncome}
                    onAcceptSuggestion={(rowHash, suggestion) => {
                      acceptSuggestion(rowHash, suggestion);
                      const it = items.find(
                        (i) =>
                          i.kind === "transaction" &&
                          (i as PreviewTx).rowHash === rowHash
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
                <span className="font-semibold">{undoState.description}</span> →{" "}
                {undoState.categoryName}
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
