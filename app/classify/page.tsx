"use client";

import { useEffect, useMemo, useState } from "react";

type Tx = {
  id: string;
  occurredAt: string;
  description: string;
  normalized: string | null;
  amountCents: number;
  monthKey: string;
  person: "PEDRO" | "MIRELA" | "AMBOS";
  wallet: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
  paymentType: "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO";
  installmentCurrent: number | null;
  installmentTotal: number | null;
  categoryId: string | null;
  tags: string[];
};

type Category = { id: string; groupName: string; name: string };

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(d);
}

export default function ClassifyPage() {
  const [loading, setLoading] = useState(false);
  const [monthKey, setMonthKey] = useState("");
  const [months, setMonths] = useState<string[]>([]);
  const [tx, setTx] = useState<Tx[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const categoryOptions = useMemo(() => {
    return categories.map((c) => ({ id: c.id, label: `${c.groupName} — ${c.name}` }));
  }, [categories]);

  async function loadBase() {
    setLoading(true);
    const res = await fetch("/api/rules"); // já traz categories junto
    const json = await res.json();
    setCategories(json.categories || []);
    setLoading(false);
  }

  async function loadMonths() {
    const res = await fetch("/api/months");
    const json = await res.json();
    setMonths(json.items || []);
    if (!monthKey && json.items?.length) setMonthKey(json.items[0]);
  }

  async function loadTx(mk: string) {
    setLoading(true);
    const res = await fetch(`/api/txlist?mes=${mk}`);
    const json = await res.json();
    setTx(json.items || []);
    setLoading(false);
  }

  useEffect(() => {
    loadBase();
    loadMonths();
  }, []);

  useEffect(() => {
    if (monthKey) loadTx(monthKey);
  }, [monthKey]);

  async function patch(id: string, data: Partial<Tx>) {
    setTx((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } as any : t)));
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data)
    });
  }

  return (
    <main className="space-y-6">
      <section className="bg-white rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Classificação rápida</h2>
            <p className="text-sm text-zinc-600 mt-1">Edite pessoa, tipo, carteira, categoria e tags rapidamente.</p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">Mês</label>
            <select className="border rounded-lg p-2 text-sm" value={monthKey} onChange={(e) => setMonthKey(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100">
              <tr className="text-left">
                <th className="p-3">Data</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Nome</th>
                <th className="p-3">Pessoa</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Carteira</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Tags</th>
                <th className="p-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tx.map((t) => (
                <tr key={t.id}>
                  <td className="p-3 whitespace-nowrap">
                    {new Intl.DateTimeFormat("pt-BR").format(new Date(t.occurredAt))}
                    {t.installmentCurrent && t.installmentTotal ? (
                      <div className="text-xs text-zinc-500">Parc {t.installmentCurrent}/{t.installmentTotal}</div>
                    ) : null}
                  </td>

                  <td className="p-3 max-w-[260px] truncate" title={t.description}>{t.description}</td>

                  <td className="p-3">
                    <input
                      className="border rounded-lg p-2 text-sm w-56"
                      value={t.normalized ?? ""}
                      onChange={(e) => patch(t.id, { normalized: e.target.value })}
                      placeholder="Nome exibido (ex.: Spotify)"
                    />
                  </td>

                  <td className="p-3">
                    <select className="border rounded-lg p-2 text-sm" value={t.person} onChange={(e) => patch(t.id, { person: e.target.value as any })}>
                      <option value="AMBOS">Ambos</option>
                      <option value="PEDRO">Pedro</option>
                      <option value="MIRELA">Mirela</option>
                    </select>
                  </td>

                  <td className="p-3">
                    <select className="border rounded-lg p-2 text-sm" value={t.paymentType} onChange={(e) => patch(t.id, { paymentType: e.target.value as any })}>
                      <option value="DEBITO_PIX">Débito/PIX</option>
                      <option value="CREDITO_A_VISTA">Crédito à vista</option>
                      <option value="PARCELADO">Parcelado</option>
                    </select>
                  </td>

                  <td className="p-3">
                    <select className="border rounded-lg p-2 text-sm" value={t.wallet} onChange={(e) => patch(t.id, { wallet: e.target.value as any })}>
                      <option value="SALARIO">Salário</option>
                      <option value="VALE_ALIMENTACAO">Vale</option>
                      <option value="OUTROS">Outros</option>
                    </select>
                  </td>

                  <td className="p-3">
                    <select
                      className="border rounded-lg p-2 text-sm w-72"
                      value={t.categoryId ?? ""}
                      onChange={(e) => patch(t.id, { categoryId: e.target.value || null })}
                    >
                      <option value="">(sem categoria)</option>
                      {categoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </td>

                  <td className="p-3">
                    <input
                      className="border rounded-lg p-2 text-sm w-56"
                      value={(t.tags || []).join(", ")}
                      onChange={(e) => patch(t.id, { tags: e.target.value.split(",").map(x => x.trim()).filter(Boolean) as any })}
                      placeholder="Ex.: Lazer, Streaming"
                    />
                  </td>

                  <td className="p-3 text-right font-semibold whitespace-nowrap">{formatBRL(t.amountCents)}</td>
                </tr>
              ))}

              {tx.length === 0 && (
                <tr>
                  <td className="p-4 text-zinc-600" colSpan={9}>
                    Sem transações nesse mês. Importe um CSV em <a className="underline" href="/import">Importar CSV</a>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && <div className="text-sm text-zinc-600 mt-3">Carregando...</div>}
      </section>
    </main>
  );
}
