"use client";

import { useMemo, useState } from "react";

type Person = "PEDRO" | "MIRELA" | "AMBOS";
type Wallet = "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
type PaymentType = "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO" | "IGNORAR";
type IncomeType = "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS" | "RESTANTE_MES_ANTERIOR";

type Category = {
  id: string;
  groupName: string;
  name: string;
};

type PreviewTx = {
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
};

type PreviewIncome = {
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

type PreviewItem = PreviewTx | PreviewIncome;

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function groupIcon(groupName: string): string {
  const g = (groupName || "").toLowerCase();
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

function pill(cls: string) {
  return `inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium border ${cls}`;
}

function pillPayment(p: PaymentType) {
  if (p === "DEBITO_PIX") return pill("bg-blue-50 text-blue-700 border-blue-200");
  if (p === "CREDITO_A_VISTA") return pill("bg-purple-50 text-purple-700 border-purple-200");
  if (p === "PARCELADO") return pill("bg-amber-50 text-amber-800 border-amber-200");
  return pill("bg-zinc-100 text-zinc-700 border-zinc-200");
}

function pillWallet(w: Wallet) {
  if (w === "SALARIO") return pill("bg-emerald-50 text-emerald-800 border-emerald-200");
  if (w === "VALE_ALIMENTACAO") return pill("bg-lime-50 text-lime-800 border-lime-200");
  return pill("bg-zinc-100 text-zinc-700 border-zinc-200");
}

type RuleDraft = {
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

function defaultDraftForItem(it: PreviewItem): RuleDraft {
  const basePattern = it.description.trim().slice(0, 80);
  if (it.kind === "income") {
    return {
      open: true,
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
      incomeType: it.incomeType
    };
  }
  return {
    open: true,
    target: "TRANSACTION",
    matchType: "CONTAINS",
    pattern: basePattern,
    priority: 20,
    renameTo: it.normalized || "",
    categoryId: it.categoryId ?? "",
    tags: (it.tags || []).join(", "),
    person: it.person,
    paymentType: it.paymentType,
    wallet: it.wallet,
    incomeType: ""
  };
}

function parseTags(s: string): string[] {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploader, setUploader] = useState<Person>("AMBOS");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, RuleDraft>>({});

  const categoriesById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const totalSelected = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  function keyOf(it: PreviewItem) {
    return it.kind === "transaction" ? it.rowHash : it.previewId;
  }

  async function preview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setStatus("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("uploader", uploader);

      const res = await fetch("/api/import/nubank/preview", { method: "POST", body: fd });
      const json = await res.json();

      if (!json.ok) {
        setStatus(json.error || "Erro ao gerar prévia.");
        setLoading(false);
        return;
      }

      setCategories(json.categories || []);
      setItems(json.items || []);

      const sel: Record<string, boolean> = {};
      const drafts: Record<string, RuleDraft> = {};
      for (const it of (json.items || []) as PreviewItem[]) {
        const k = it.kind === "transaction" ? it.rowHash : it.previewId;
        sel[k] = true;
        drafts[k] = { ...defaultDraftForItem(it), open: false };
      }
      setSelected(sel);
      setRuleDrafts(drafts);

      setModalOpen(true);
      setStatus("");
    } catch (err: any) {
      setStatus(err?.message || "Falha ao gerar prévia.");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    setLoading(true);
    setStatus("");

    try {
      const payloadItems = items.filter((it) => selected[keyOf(it)]);

      const res = await fetch("/api/import/nubank/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: payloadItems })
      });

      const json = await res.json();
      if (!json.ok) {
        setStatus(json.error || "Erro ao importar.");
        setLoading(false);
        return;
      }

      setStatus(
        `Importação concluída ✅ Transações: +${json.insertedTx} (skip ${json.skippedTx}) | Entradas: +${json.insertedIncome} (skip ${json.skippedIncome})`
      );
      setModalOpen(false);
      setItems([]);
      setSelected({});
      setRuleDrafts({});
    } catch (err: any) {
      setStatus(err?.message || "Falha ao importar.");
    } finally {
      setLoading(false);
    }
  }

  function setTx(rowHash: string, patch: Partial<PreviewTx>) {
    setItems((prev) =>
      prev.map((it) => (it.kind === "transaction" && it.rowHash === rowHash ? ({ ...it, ...patch } as PreviewTx) : it))
    );
  }

  function setIncome(previewId: string, patch: Partial<PreviewIncome>) {
    setItems((prev) =>
      prev.map((it) => (it.kind === "income" && it.previewId === previewId ? ({ ...it, ...patch } as PreviewIncome) : it))
    );
  }

  function toggleAll(v: boolean) {
    const sel: Record<string, boolean> = {};
    for (const it of items) sel[keyOf(it)] = v;
    setSelected(sel);
  }

  function openRule(k: string) {
    setRuleDrafts((d) => ({ ...d, [k]: { ...(d[k] || ({ open: true } as any)), open: true, error: "", ok: "" } }));
  }
  function closeRule(k: string) {
    setRuleDrafts((d) => ({ ...d, [k]: { ...(d[k] || ({ open: false } as any)), open: false } }));
  }

  function setDraft(k: string, patch: Partial<RuleDraft>) {
    setRuleDrafts((d) => ({ ...d, [k]: { ...(d[k] || ({} as any)), ...patch } }));
  }

  // ✅ aplica o draft no item atual (efeito imediato na prévia), sem endpoint novo
  function applyDraftToThisLine(k: string) {
    const d = ruleDrafts[k];
    if (!d) return;

    setItems((prev) =>
      prev.map((it) => {
        const id = keyOf(it);
        if (id !== k) return it;

        // aplica somente quando "tipo do draft" é compatível com o item
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
          if (d.incomeType) patch.incomeType = d.incomeType as IncomeType;
          return { ...it, ...patch } as PreviewIncome;
        }

        // Se você quiser futuramente: converter Transaction <-> Income, a gente implementa depois.
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
        priority: Number(d.priority)
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
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!json.ok) {
        setDraft(k, { saving: false, error: json.error || "Erro ao criar regra." });
        return;
      }

      if (applyNow) {
        applyDraftToThisLine(k);
        setDraft(k, { saving: false, ok: "Regra criada ✅ e aplicada nesta linha (prévia)." });
      } else {
        setDraft(k, { saving: false, ok: "Regra criada ✅ (vale para próximos imports)." });
      }
    } catch (err: any) {
      setDraft(k, { saving: false, error: err?.message || "Erro ao criar regra." });
    }
  }

  return (
    <main className="space-y-6">
      <section className="bg-white rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Importar CSV (Nubank)</h2>
        <p className="text-sm text-zinc-600 mt-1">
          Ao enviar, abrimos uma prévia com regras e você ajusta antes de gravar no banco.
        </p>

        <form className="mt-4 space-y-4" onSubmit={preview}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Quem está fazendo o upload?</label>
              <select className="mt-1 w-full border rounded-lg p-2" value={uploader} onChange={(e) => setUploader(e.target.value as Person)}>
                <option value="AMBOS">Ambos</option>
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

          <button disabled={!file || loading} className="border rounded-lg px-4 py-2 bg-zinc-900 text-white disabled:opacity-50">
            {loading ? "Processando..." : "Gerar prévia"}
          </button>

          {status && <div className="text-sm border rounded-lg p-3 bg-zinc-50">{status}</div>}
        </form>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => !loading && setModalOpen(false)} />

          <div className="absolute inset-0 p-3 md:p-6 flex items-center justify-center">
            <div className="w-[75vw] max-w-[1400px] bg-white rounded-2xl border shadow-xl overflow-hidden">
              <div className="p-4 md:p-5 border-b flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Prévia da importação</div>
                  <div className="text-sm text-zinc-600">
                    Selecione, edite, crie regras e confirme. Nada é gravado até confirmar.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button className="text-sm underline" onClick={() => toggleAll(true)} disabled={loading}>
                    Selecionar tudo
                  </button>
                  <button className="text-sm underline" onClick={() => toggleAll(false)} disabled={loading}>
                    Limpar seleção
                  </button>

                  <div className="text-sm text-zinc-700 border rounded-lg px-3 py-2 bg-zinc-50">
                    Selecionados: <span className="font-semibold">{totalSelected}</span>
                  </div>

                  <button
                    className="border rounded-lg px-4 py-2 bg-zinc-900 text-white disabled:opacity-50"
                    onClick={commit}
                    disabled={loading || totalSelected === 0}
                  >
                    {loading ? "Importando..." : "Confirmar importação"}
                  </button>

                  <button className="border rounded-lg px-4 py-2 bg-white" onClick={() => setModalOpen(false)} disabled={loading}>
                    Fechar
                  </button>
                </div>
              </div>

              <div className="p-4 md:p-5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <thead className="bg-zinc-100">
                      <tr className="text-left">
                        <th className="p-3 w-[56px]">✓</th>
                        <th className="p-3 w-[92px]">Data</th>
                        <th className="p-3 w-[320px]">Detalhes</th>
                        <th className="p-3 w-[140px]">Pessoa</th>
                        <th className="p-3 w-[170px]">Tipo</th>
                        <th className="p-3 w-[160px]">Carteira</th>
                        <th className="p-3 w-[240px]">Categoria</th>
                        <th className="p-3 w-[190px]">Tags</th>
                        <th className="p-3 w-[220px]">Notas</th>
                        <th className="p-3 w-[120px] text-right">Valor</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {items.map((it) => {
                        const k = keyOf(it);
                        const checked = !!selected[k];
                        const dateStr = new Intl.DateTimeFormat("pt-BR").format(new Date(it.occurredAt));

                        const catLabel =
                          it.kind === "transaction" && it.categoryId
                            ? (() => {
                                const c = categoriesById.get(it.categoryId!);
                                if (!c) return "";
                                return `${groupIcon(c.groupName)} ${c.groupName} — ${c.name}`;
                              })()
                            : "";

                        const d = ruleDrafts[k];

                        return (
                          <>
                            <tr key={k} className={checked ? "" : "opacity-60"}>
                              <td className="p-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => setSelected((s) => ({ ...s, [k]: e.target.checked }))}
                                />
                              </td>

                              <td className="p-3 align-top whitespace-nowrap">
                                {dateStr}
                                {it.kind === "transaction" && it.installmentCurrent && it.installmentTotal ? (
                                  <div className="text-xs text-zinc-500">
                                    Parc {it.installmentCurrent}/{it.installmentTotal}
                                  </div>
                                ) : null}
                              </td>

                              <td className="p-3 align-top">
                                <div className="font-medium break-words">{it.description}</div>
                                <div className="text-xs text-zinc-500 mt-1">{it.kind === "income" ? "Entrada (Income)" : it.source}</div>

                                {it.kind === "transaction" ? (
                                  <div className="mt-2">
                                    <div className="text-xs text-zinc-600 mb-1">Nome (exibição)</div>
                                    <input
                                      className="border rounded-lg p-2 w-full"
                                      value={it.normalized}
                                      onChange={(e) => setTx(it.rowHash, { normalized: e.target.value })}
                                      placeholder="Ex.: Spotify"
                                    />
                                  </div>
                                ) : null}

                                <div className="mt-2">
                                  <button className="text-xs underline" onClick={() => openRule(k)}>
                                    ➕ Criar regra a partir desta linha
                                  </button>
                                </div>
                              </td>

                              <td className="p-3 align-top">
                                <select
                                  className="border rounded-lg p-2 w-full"
                                  value={it.person}
                                  onChange={(e) =>
                                    it.kind === "transaction"
                                      ? setTx(it.rowHash, { person: e.target.value as Person })
                                      : setIncome(it.previewId, { person: e.target.value as Person })
                                  }
                                >
                                  <option value="AMBOS">Ambos</option>
                                  <option value="PEDRO">Pedro</option>
                                  <option value="MIRELA">Mirela</option>
                                </select>
                              </td>

                              <td className="p-3 align-top">
                                {it.kind === "transaction" ? (
                                  <>
                                    <div className={pillPayment(it.paymentType)}>
                                      {it.paymentType === "DEBITO_PIX" ? "🔵 Débito/PIX" : null}
                                      {it.paymentType === "CREDITO_A_VISTA" ? "🟣 Crédito à vista" : null}
                                      {it.paymentType === "PARCELADO" ? "🟠 Parcelado" : null}
                                      {it.paymentType === "IGNORAR" ? "⚪ Ignorar" : null}
                                    </div>
                                    <select
                                      className="border rounded-lg p-2 w-full mt-2"
                                      value={it.paymentType}
                                      onChange={(e) => setTx(it.rowHash, { paymentType: e.target.value as PaymentType })}
                                    >
                                      <option value="DEBITO_PIX">Débito/PIX</option>
                                      <option value="CREDITO_A_VISTA">Crédito à vista</option>
                                      <option value="PARCELADO">Parcelado</option>
                                      <option value="IGNORAR">Ignorar</option>
                                    </select>
                                  </>
                                ) : (
                                  <>
                                    <div className={pill("bg-emerald-50 text-emerald-800 border-emerald-200")}>💵 Entrada</div>
                                    <select
                                      className="border rounded-lg p-2 w-full mt-2"
                                      value={it.incomeType}
                                      onChange={(e) => setIncome(it.previewId, { incomeType: e.target.value as IncomeType })}
                                    >
                                      <option value="SALARIO">Salário</option>
                                      <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                                      <option value="OUTROS">Outros</option>
                                      <option value="RESTANTE_MES_ANTERIOR">Restante Mês Anterior</option>
                                    </select>
                                  </>
                                )}
                              </td>

                              <td className="p-3 align-top">
                                <div className={pillWallet(it.wallet)}>
                                  {it.wallet === "SALARIO" ? "🟢 Salário" : null}
                                  {it.wallet === "VALE_ALIMENTACAO" ? "🟡 Vale" : null}
                                  {it.wallet === "OUTROS" ? "⚫ Outros" : null}
                                </div>
                                <select
                                  className="border rounded-lg p-2 w-full mt-2"
                                  value={it.wallet}
                                  onChange={(e) =>
                                    it.kind === "transaction"
                                      ? setTx(it.rowHash, { wallet: e.target.value as Wallet })
                                      : setIncome(it.previewId, { wallet: e.target.value as Wallet })
                                  }
                                >
                                  <option value="SALARIO">Salário</option>
                                  <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                                  <option value="OUTROS">Outros</option>
                                </select>
                              </td>

                              <td className="p-3 align-top">
                                {it.kind === "transaction" ? (
                                  <>
                                    <select
                                      className="border rounded-lg p-2 w-full"
                                      value={it.categoryId ?? ""}
                                      onChange={(e) => setTx(it.rowHash, { categoryId: e.target.value || null })}
                                    >
                                      <option value="">(sem categoria)</option>
                                      {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {groupIcon(c.groupName)} {c.groupName} — {c.name}
                                        </option>
                                      ))}
                                    </select>
                                    {it.categoryId ? <div className="text-xs text-zinc-500 mt-1 break-words">{catLabel}</div> : null}
                                  </>
                                ) : (
                                  <div className="text-xs text-zinc-600">—</div>
                                )}
                              </td>

                              <td className="p-3 align-top">
                                {it.kind === "transaction" ? (
                                  <input
                                    className="border rounded-lg p-2 w-full"
                                    value={(it.tags || []).join(", ")}
                                    onChange={(e) =>
                                      setTx(it.rowHash, { tags: parseTags(e.target.value) })
                                    }
                                    placeholder="Ex.: Caixinha, Investimento"
                                  />
                                ) : (
                                  <div className="text-xs text-zinc-600">—</div>
                                )}
                              </td>

                              <td className="p-3 align-top">
                                <textarea
                                  className="border rounded-lg p-2 w-full min-h-[44px]"
                                  value={it.notes ?? ""}
                                  onChange={(e) =>
                                    it.kind === "transaction"
                                      ? setTx(it.rowHash, { notes: e.target.value })
                                      : setIncome(it.previewId, { notes: e.target.value })
                                  }
                                  placeholder="Observações (opcional)"
                                />
                              </td>

                              <td className="p-3 align-top text-right font-semibold whitespace-nowrap">
                                {formatBRL(it.amountCents)}
                              </td>
                            </tr>

                            {d?.open ? (
                              <tr key={`${k}-rule`}>
                                <td colSpan={10} className="p-4 bg-zinc-50">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="font-semibold text-sm">Criar regra (para próximos imports)</div>
                                    <button className="text-sm underline" onClick={() => closeRule(k)} disabled={d.saving}>
                                      Fechar
                                    </button>
                                  </div>

                                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <label className="text-xs font-medium">Alvo</label>
                                      <select className="mt-1 w-full border rounded-lg p-2"
                                        value={d.target}
                                        onChange={(e) => setDraft(k, { target: e.target.value as any })}
                                      >
                                        <option value="TRANSACTION">Transação</option>
                                        <option value="INCOME">Entrada</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="text-xs font-medium">Match</label>
                                      <select className="mt-1 w-full border rounded-lg p-2"
                                        value={d.matchType}
                                        onChange={(e) => setDraft(k, { matchType: e.target.value as any })}
                                      >
                                        <option value="CONTAINS">Contém</option>
                                        <option value="STARTS_WITH">Começa com</option>
                                        <option value="REGEX">Regex</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="text-xs font-medium">Prioridade</label>
                                      <input className="mt-1 w-full border rounded-lg p-2"
                                        type="number"
                                        value={d.priority}
                                        onChange={(e) => setDraft(k, { priority: Number(e.target.value) })}
                                      />
                                    </div>

                                    <div className="md:col-span-3">
                                      <label className="text-xs font-medium">Padrão (pattern)</label>
                                      <input className="mt-1 w-full border rounded-lg p-2"
                                        value={d.pattern}
                                        onChange={(e) => setDraft(k, { pattern: e.target.value })}
                                        placeholder="Ex.: compra no débito - 99*"
                                      />
                                      <div className="text-xs text-zinc-500 mt-1">
                                        Dica: use um trecho estável (não precisa colar a linha inteira).
                                      </div>
                                    </div>

                                    {d.target === "TRANSACTION" ? (
                                      <>
                                        <div>
                                          <label className="text-xs font-medium">Renomear para</label>
                                          <input className="mt-1 w-full border rounded-lg p-2"
                                            value={d.renameTo}
                                            onChange={(e) => setDraft(k, { renameTo: e.target.value })}
                                            placeholder="Ex.: Uber"
                                          />
                                        </div>

                                        <div>
                                          <label className="text-xs font-medium">Categoria</label>
                                          <select className="mt-1 w-full border rounded-lg p-2"
                                            value={d.categoryId}
                                            onChange={(e) => setDraft(k, { categoryId: e.target.value })}
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
                                          <input className="mt-1 w-full border rounded-lg p-2"
                                            value={d.tags}
                                            onChange={(e) => setDraft(k, { tags: e.target.value })}
                                            placeholder="Ex.: Transporte, 99"
                                          />
                                        </div>

                                        <div>
                                          <label className="text-xs font-medium">Pessoa</label>
                                          <select className="mt-1 w-full border rounded-lg p-2"
                                            value={d.person}
                                            onChange={(e) => setDraft(k, { person: e.target.value as any })}
                                          >
                                            <option value="">(não setar)</option>
                                            <option value="AMBOS">Ambos</option>
                                            <option value="PEDRO">Pedro</option>
                                            <option value="MIRELA">Mirela</option>
                                          </select>
                                        </div>

                                        <div>
                                          <label className="text-xs font-medium">Tipo</label>
                                          <select className="mt-1 w-full border rounded-lg p-2"
                                            value={d.paymentType}
                                            onChange={(e) => setDraft(k, { paymentType: e.target.value as any })}
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
                                          <select className="mt-1 w-full border rounded-lg p-2"
                                            value={d.wallet}
                                            onChange={(e) => setDraft(k, { wallet: e.target.value as any })}
                                          >
                                            <option value="">(não setar)</option>
                                            <option value="SALARIO">Salário</option>
                                            <option value="VALE_ALIMENTACAO">Vale</option>
                                            <option value="OUTROS">Outros</option>
                                          </select>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div>
                                          <label className="text-xs font-medium">Income Type</label>
                                          <select className="mt-1 w-full border rounded-lg p-2"
                                            value={d.incomeType}
                                            onChange={(e) => setDraft(k, { incomeType: e.target.value as any })}
                                          >
                                            <option value="">(obrigatório)</option>
                                            <option value="SALARIO">Salário</option>
                                            <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                                            <option value="OUTROS">Outros</option>
                                            <option value="RESTANTE_MES_ANTERIOR">Restante Mês Anterior</option>
                                          </select>
                                        </div>

                                        <div>
                                          <label className="text-xs font-medium">Pessoa</label>
                                          <select className="mt-1 w-full border rounded-lg p-2"
                                            value={d.person}
                                            onChange={(e) => setDraft(k, { person: e.target.value as any })}
                                          >
                                            <option value="">(não setar)</option>
                                            <option value="AMBOS">Ambos</option>
                                            <option value="PEDRO">Pedro</option>
                                            <option value="MIRELA">Mirela</option>
                                          </select>
                                        </div>

                                        <div>
                                          <label className="text-xs font-medium">Carteira</label>
                                          <select className="mt-1 w-full border rounded-lg p-2"
                                            value={d.wallet}
                                            onChange={(e) => setDraft(k, { wallet: e.target.value as any })}
                                          >
                                            <option value="">(não setar)</option>
                                            <option value="SALARIO">Salário</option>
                                            <option value="VALE_ALIMENTACAO">Vale</option>
                                            <option value="OUTROS">Outros</option>
                                          </select>
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  {(d.error || d.ok) && (
                                    <div
                                      className={`mt-3 text-sm border rounded-lg p-3 ${
                                        d.error ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
                                      }`}
                                    >
                                      {d.error || d.ok}
                                    </div>
                                  )}

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      className="border rounded-lg px-4 py-2 bg-zinc-900 text-white disabled:opacity-50"
                                      onClick={() => saveRule(k, false)}
                                      disabled={!!d.saving}
                                    >
                                      {d.saving ? "Salvando..." : "Salvar regra"}
                                    </button>

                                    <button
                                      className="border rounded-lg px-4 py-2 bg-white disabled:opacity-50"
                                      onClick={() => saveRule(k, true)}
                                      disabled={!!d.saving}
                                    >
                                      {d.saving ? "Salvando..." : "Salvar e aplicar nesta linha"}
                                    </button>

                                    <button
                                      className="border rounded-lg px-4 py-2 bg-white"
                                      onClick={() => closeRule(k)}
                                      disabled={!!d.saving}
                                    >
                                      Cancelar
                                    </button>
                                  </div>

                                  <div className="mt-2 text-xs text-zinc-500">
                                    “Salvar e aplicar” muda apenas esta linha na prévia (sem reprocessar o arquivo inteiro).
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </>
                        );
                      })}

                      {items.length === 0 && (
                        <tr>
                          <td colSpan={10} className="p-4 text-zinc-600">
                            Nenhum item na prévia.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-xs text-zinc-500">
                  Dica: marque “Ignorar” para itens que não devem entrar nos totais (ex.: pagamento de fatura, caixinhas).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
