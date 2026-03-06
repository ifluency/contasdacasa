"use client";

import { useEffect, useMemo, useState } from "react";

type Person = "PEDRO" | "MIRELA" | "AMBOS";
type Wallet = "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
type PaymentType = "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO" | "IGNORAR";

type Category = { id: string; groupName: string; name: string };

function formatMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function toCents(v: string): number {
  const raw = (v ?? "").toString().trim();
  if (!raw) return 0;
  const s = raw.replace(/\s/g, "").replace(/^R\$/i, "").replace(",", ".");
  const n = Number(s);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export default function ManualPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState("");

  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>("");
  const [normalized, setNormalized] = useState<string>("");
  const [amount, setAmount] = useState<string>("0.00");

  const [person, setPerson] = useState<Person>("AMBOS");
  const [wallet, setWallet] = useState<Wallet>("SALARIO");
  const [paymentType, setPaymentType] = useState<PaymentType>("DEBITO_PIX");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tags, setTags] = useState<string>("");

  const [split5050, setSplit5050] = useState(false);

  const monthKey = useMemo(() => formatMonthKey(date), [date]);

  useEffect(() => {
    (async () => {
      // reaproveita /api/rules (já existe) para obter categorias
      const res = await fetch("/api/rules", { cache: "no-store" });
      const json = await res.json();
      setCategories(json.categories || []);
    })();
  }, []);

  async function save() {
    setStatus("");

    const baseTags = tags.split(",").map(t => t.trim()).filter(Boolean);
    const finalTags = new Set(baseTags);

    const finalPerson: Person = split5050 ? "AMBOS" : person;
    if (split5050) finalTags.add("Fixa Dividida");

    const item = {
      kind: "transaction",
      rowHash: `manual|${Date.now()}|${Math.random().toString(16).slice(2)}`,
      source: "manual",
      externalId: null,
      occurredAt: new Date(date + "T12:00:00.000Z").toISOString(),
      monthKey,
      description,
      normalized: normalized || description,
      amountCents: toCents(amount),
      person: finalPerson,
      wallet,
      paymentType,
      categoryId: categoryId || null,
      tags: Array.from(finalTags),
      installmentCurrent: null,
      installmentTotal: null,
      notes: null
    };

    const res = await fetch("/api/import/nubank/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [item] })
    });

    const json = await res.json();
    if (!json.ok) {
      setStatus(json.error || "Erro ao salvar.");
      return;
    }

    setStatus("Salvo ✅");
    setDescription("");
    setNormalized("");
    setAmount("0.00");
    setCategoryId("");
    setTags("");
    setSplit5050(false);
  }

  return (
    <main className="space-y-6">
      <section className="bg-white rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Adicionar manualmente</h2>
        <p className="text-sm text-zinc-600 mt-1">
          Crie um lançamento manual sem CSV (usa a mesma gravação do sistema).
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Data</label>
            <input className="mt-1 w-full border rounded-lg p-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium">Valor (R$)</label>
            <input className="mt-1 w-full border rounded-lg p-2" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex.: 31.90" />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Descrição (original)</label>
            <input className="mt-1 w-full border rounded-lg p-2" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Nome (exibição)</label>
            <input className="mt-1 w-full border rounded-lg p-2" value={normalized} onChange={(e) => setNormalized(e.target.value)} placeholder="Opcional" />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={split5050}
              onChange={(e) => setSplit5050(e.target.checked)}
            />
            <span className="text-sm">Dividir 50/50 (conta fixa dividida)</span>
          </div>

          <div>
            <label className="text-sm font-medium">Pessoa</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={person} onChange={(e) => setPerson(e.target.value as Person)} disabled={split5050}>
              <option value="PEDRO">Pedro</option>
              <option value="MIRELA">Mirela</option>
              <option value="AMBOS">Ambos</option>
            </select>
            {split5050 && <div className="text-xs text-zinc-500 mt-1">Com “Dividir 50/50”, Pessoa fica automaticamente “Ambos”.</div>}
          </div>

          <div>
            <label className="text-sm font-medium">Tipo</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)}>
              <option value="DEBITO_PIX">Débito/PIX</option>
              <option value="CREDITO_A_VISTA">Crédito à vista</option>
              <option value="PARCELADO">Parcelado</option>
              <option value="IGNORAR">Ignorar</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Carteira</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={wallet} onChange={(e) => setWallet(e.target.value as Wallet)}>
              <option value="SALARIO">Salário</option>
              <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
              <option value="OUTROS">Outros</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Categoria</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">(sem categoria)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.groupName} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Tags (vírgula)</label>
            <input className="mt-1 w-full border rounded-lg p-2" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ex.: Transporte, Uber" />
            <div className="text-xs text-zinc-500 mt-1">
              Se “Dividir 50/50” estiver marcado, adiciona automaticamente a tag <b>Fixa Dividida</b>.
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2 items-center">
          <button className="border rounded-lg px-4 py-2 bg-zinc-900 text-white" onClick={save} disabled={!description.trim()}>
            Salvar
          </button>
          <a className="underline text-sm" href="/import">Voltar</a>
        </div>

        {status && <div className="mt-3 text-sm border rounded-lg p-3 bg-zinc-50">{status}</div>}
      </section>
    </main>
  );
}
