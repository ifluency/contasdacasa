"use client";

import { useMemo, useState } from "react";

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
  person: "PEDRO" | "MIRELA" | "AMBOS";
  wallet: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
  paymentType: "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO" | "IGNORAR";
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
  person: "PEDRO" | "MIRELA" | "AMBOS";
  wallet: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
  incomeType: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS" | "RESTANTE_MES_ANTERIOR";
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

function badgePayment(p: string) {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium";
  if (p === "DEBITO_PIX") return `${base} bg-blue-50 text-blue-700 border border-blue-200`;
  if (p === "CREDITO_A_VISTA") return `${base} bg-purple-50 text-purple-700 border border-purple-200`;
  if (p === "PARCELADO") return `${base} bg-amber-50 text-amber-800 border border-amber-200`;
  if (p === "IGNORAR") return `${base} bg-zinc-100 text-zinc-700 border border-zinc-200`;
  return `${base} bg-zinc-100 text-zinc-700 border border-zinc-200`;
}

function badgeWallet(w: string) {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium";
  if (w === "SALARIO") return `${base} bg-emerald-50 text-emerald-800 border border-emerald-200`;
  if (w === "VALE_ALIMENTACAO") return `${base} bg-lime-50 text-lime-800 border border-lime-200`;
  return `${base} bg-zinc-100 text-zinc-700 border border-zinc-200`;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  const [modalOpen, setModalOpen] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({}); // rowHash or previewId

  const categoriesById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const totalSelected = useMemo(() => {
    return Object.values(selected).filter(Boolean).length;
  }, [selected]);

  async function preview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setStatus("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/import/nubank/preview", { method: "POST", body: fd });
      const json = await res.json();

      if (!json.ok) {
        setStatus(json.error || "Erro ao gerar prévia.");
        setLoading(false);
        return;
      }

      setCategories(json.categories || []);
      setItems(json.items || []);

      // marca todos como selecionados por padrão
      const sel: Record<string, boolean> = {};
      for (const it of (json.items || []) as PreviewItem[]) {
        const key = it.kind === "transaction" ? it.rowHash : it.previewId;
        sel[key] = true;
      }
      setSelected(sel);

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
      const payloadItems = items
        .filter((it) => {
          const key = it.kind === "transaction" ? it.rowHash : it.previewId;
          return selected[key];
        })
        // se for IGNORAR e você não quiser nem gravar, descomente:
        // .filter((it) => it.kind !== "transaction" || it.paymentType !== "IGNORAR")
        ;

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
    } catch (err: any) {
      setStatus(err?.message || "Falha ao importar.");
    } finally {
      setLoading(false);
    }
  }

  function setFieldTx(id: string, patch: Partial<PreviewTx>) {
    setItems((prev) =>
      prev.map((it) =>
        it.kind === "transaction" && it.rowHash === id ? ({ ...it, ...patch } as PreviewTx) : it
      )
    );
  }

  function setFieldIncome(id: string, patch: Partial<PreviewIncome>) {
    setItems((prev) =>
      prev.map((it) =>
        it.kind === "income" && it.previewId === id ? ({ ...it, ...patch } as PreviewIncome) : it
      )
    );
  }

  function toggleAll(v: boolean) {
    const sel: Record<string, boolean> = {};
    for (const it of items) {
      const key = it.kind === "transaction" ? it.rowHash : it.previewId;
      sel[key] = v;
    }
    setSelected(sel);
  }

  return (
    <main className="space-y-6">
      <section className="bg-white rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Importar CSV (Nubank)</h2>
        <p className="text-sm text-zinc-600 mt-1">
          Ao enviar, abrimos uma prévia com regras e você ajusta antes de gravar no banco.
        </p>

        <form className="mt-4 space-y-4" onSubmit={preview}>
          <div>
            <label className="text-sm font-medium">Arquivo CSV</label>
            <input
              className="mt-1 w-full border rounded-lg p-2 bg-white"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
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
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !loading && setModalOpen(false)}
          />

          {/* modal */}
          <div className="absolute inset-0 p-4 md:p-8 flex items-center justify-center">
            <div className="w-full max-w-6xl bg-white rounded-2xl border shadow-xl overflow-hidden">
              <div className="p-4 md:p-5 border-b flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Prévia da importação</div>
                  <div className="text-sm text-zinc-600">
                    Selecione, edite e confirme. Nada é gravado até você confirmar.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="text-sm underline"
                    onClick={() => toggleAll(true)}
                    disabled={loading}
                  >
                    Selecionar tudo
                  </button>
                  <button
                    className="text-sm underline"
                    onClick={() => toggleAll(false)}
                    disabled={loading}
                  >
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

                  <button
                    className="border rounded-lg px-4 py-2 bg-white"
                    onClick={() => setModalOpen(false)}
                    disabled={loading}
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="p-4 md:p-5">
                <div className="overflow-auto border rounded-xl">
                  <table className="min-w-[1200px] w-full text-sm">
                    <thead className="bg-zinc-100">
                      <tr className="text-left">
                        <th className="p-3 w-[70px]">Importar</th>
                        <th className="p-3 w-[110px]">Data</th>
                        <th className="p-3">Descrição</th>
                        <th className="p-3 w-[220px]">Nome</th>
                        <th className="p-3 w-[110px]">Pessoa</th>
                        <th className="p-3 w-[170px]">Tipo</th>
                        <th className="p-3 w-[160px]">Carteira</th>
                        <th className="p-3 w-[320px]">Categoria</th>
                        <th className="p-3 w-[220px]">Tags</th>
                        <th className="p-3 w-[140px] text-right">Valor</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {items.map((it) => {
                        const key = it.kind === "transaction" ? it.rowHash : it.previewId;
                        const checked = !!selected[key];

                        const dateStr = new Intl.DateTimeFormat("pt-BR").format(
                          new Date(it.occurredAt)
                        );

                        // categorias / label
                        const categoryLabel = it.kind === "transaction" && it.categoryId
                          ? (() => {
                              const c = categoriesById.get(it.categoryId!);
                              if (!c) return "(categoria)";
                              return `${groupIcon(c.groupName)} ${c.groupName} — ${c.name}`;
                            })()
                          : "";

                        return (
                          <tr key={key} className={checked ? "" : "opacity-60"}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setSelected((s) => ({ ...s, [key]: e.target.checked }))}
                              />
                            </td>

                            <td className="p-3 whitespace-nowrap">
                              {dateStr}
                              {it.kind === "transaction" && it.installmentCurrent && it.installmentTotal ? (
                                <div className="text-xs text-zinc-500">
                                  Parc {it.installmentCurrent}/{it.installmentTotal}
                                </div>
                              ) : null}
                            </td>

                            <td className="p-3">
                              <div className="font-medium">{it.description}</div>
                              <div className="text-xs text-zinc-500">
                                {it.kind === "income" ? "Entrada (Income)" : it.source}
                              </div>
                            </td>

                            <td className="p-3">
                              {it.kind === "transaction" ? (
                                <input
                                  className="border rounded-lg p-2 w-full"
                                  value={it.normalized}
                                  onChange={(e) => setFieldTx(it.rowHash, { normalized: e.target.value })}
                                />
                              ) : (
                                <div className="text-xs text-zinc-600">—</div>
                              )}
                            </td>

                            <td className="p-3">
                              <select
                                className="border rounded-lg p-2 w-full"
                                value={it.person}
                                onChange={(e) =>
                                  it.kind === "transaction"
                                    ? setFieldTx(it.rowHash, { person: e.target.value as any })
                                    : setFieldIncome(it.previewId, { person: e.target.value as any })
                                }
                              >
                                <option value="AMBOS">Ambos</option>
                                <option value="PEDRO">Pedro</option>
                                <option value="MIRELA">Mirela</option>
                              </select>
                            </td>

                            <td className="p-3">
                              {it.kind === "transaction" ? (
                                <div className="space-y-2">
                                  <div className={badgePayment(it.paymentType)}>
                                    {it.paymentType === "DEBITO_PIX" ? "🔵 Débito/PIX" : null}
                                    {it.paymentType === "CREDITO_A_VISTA" ? "🟣 Crédito à vista" : null}
                                    {it.paymentType === "PARCELADO" ? "🟠 Parcelado" : null}
                                    {it.paymentType === "IGNORAR" ? "⚪ Ignorar" : null}
                                  </div>
                                  <select
                                    className="border rounded-lg p-2 w-full"
                                    value={it.paymentType}
                                    onChange={(e) => setFieldTx(it.rowHash, { paymentType: e.target.value as any })}
                                  >
                                    <option value="DEBITO_PIX">Débito/PIX</option>
                                    <option value="CREDITO_A_VISTA">Crédito à vista</option>
                                    <option value="PARCELADO">Parcelado</option>
                                    <option value="IGNORAR">Ignorar</option>
                                  </select>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    💵 Entrada
                                  </div>
                                  <select
                                    className="border rounded-lg p-2 w-full"
                                    value={it.incomeType}
                                    onChange={(e) => setFieldIncome(it.previewId, { incomeType: e.target.value as any })}
                                  >
                                    <option value="SALARIO">Salário</option>
                                    <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                                    <option value="OUTROS">Outros</option>
                                    <option value="RESTANTE_MES_ANTERIOR">Restante Mês Anterior</option>
                                  </select>
                                </div>
                              )}
                            </td>

                            <td className="p-3">
                              <div className={badgeWallet(it.wallet)}>
                                {it.wallet === "SALARIO" ? "🟢 Salário" : null}
                                {it.wallet === "VALE_ALIMENTACAO" ? "🟡 Vale" : null}
                                {it.wallet === "OUTROS" ? "⚫ Outros" : null}
                              </div>

                              <select
                                className="border rounded-lg p-2 w-full mt-2"
                                value={it.wallet}
                                onChange={(e) =>
                                  it.kind === "transaction"
                                    ? setFieldTx(it.rowHash, { wallet: e.target.value as any })
                                    : setFieldIncome(it.previewId, { wallet: e.target.value as any })
                                }
                              >
                                <option value="SALARIO">Salário</option>
                                <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                                <option value="OUTROS">Outros</option>
                              </select>
                            </td>

                            <td className="p-3">
                              {it.kind === "transaction" ? (
                                <>
                                  <select
                                    className="border rounded-lg p-2 w-full"
                                    value={it.categoryId ?? ""}
                                    onChange={(e) => setFieldTx(it.rowHash, { categoryId: e.target.value || null })}
                                  >
                                    <option value="">(sem categoria)</option>
                                    {categories.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {groupIcon(c.groupName)} {c.groupName} — {c.name}
                                      </option>
                                    ))}
                                  </select>
                                  {it.categoryId ? (
                                    <div className="text-xs text-zinc-500 mt-1">{categoryLabel}</div>
                                  ) : null}
                                </>
                              ) : (
                                <div className="text-xs text-zinc-600">—</div>
                              )}
                            </td>

                            <td className="p-3">
                              {it.kind === "transaction" ? (
                                <input
                                  className="border rounded-lg p-2 w-full"
                                  value={(it.tags || []).join(", ")}
                                  onChange={(e) =>
                                    setFieldTx(it.rowHash, {
                                      tags: e.target.value
                                        .split(",")
                                        .map((x) => x.trim())
                                        .filter(Boolean)
                                    })
                                  }
                                  placeholder="Ex.: Lazer, Streaming"
                                />
                              ) : (
                                <div className="text-xs text-zinc-600">—</div>
                              )}
                            </td>

                            <td className="p-3 text-right font-semibold whitespace-nowrap">
                              {formatBRL(it.amountCents)}
                            </td>
                          </tr>
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
