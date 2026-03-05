"use client";

import { useEffect, useMemo, useState } from "react";

type Category = { id: string; groupName: string; name: string };
type Rule = {
  id: string;
  isActive: boolean;
  target: "TRANSACTION" | "INCOME";
  matchType: "CONTAINS" | "STARTS_WITH" | "REGEX";
  pattern: string;
  priority: number;

  renameTo: string | null;
  categoryId: string | null;
  tags: string[];

  person: "PEDRO" | "MIRELA" | "AMBOS" | null;
  paymentType: "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO" | null;
  wallet: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS" | null;

  incomeType: "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS" | "RESTANTE_MES_ANTERIOR" | null;
};

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: `Resposta não-JSON (${res.status}). Provável 404/500. Trecho: ${text.slice(0, 200)}` };
  }
}

export default function RulesPage() {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // form
  const [target, setTarget] = useState<Rule["target"]>("TRANSACTION");
  const [matchType, setMatchType] = useState<Rule["matchType"]>("CONTAINS");
  const [pattern, setPattern] = useState("");
  const [priority, setPriority] = useState(100);

  const [renameTo, setRenameTo] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [tags, setTags] = useState("");

  const [person, setPerson] = useState<string>("");
  const [paymentType, setPaymentType] = useState<string>("");
  const [wallet, setWallet] = useState<string>("");

  const [incomeType, setIncomeType] = useState<string>("");

  async function load() {
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/rules", { cache: "no-store" });
      const json = await safeJson(res);

      if (!json.ok) {
        setStatusMsg(json.error || "Erro ao carregar regras.");
        setRules([]);
        setCategories([]);
      } else {
        setRules(json.items || []);
        setCategories(json.categories || []);
      }
    } catch (e: any) {
      setStatusMsg(e?.message || "Falha ao carregar /api/rules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const categoryOptions = useMemo(() => {
    return categories.map((c) => ({
      id: c.id,
      label: `${c.groupName} — ${c.name}`
    }));
  }, [categories]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatusMsg("");

    try {
      const payload: any = {
        target,
        matchType,
        pattern: pattern.trim(),
        priority: Number(priority)
      };

      if (renameTo.trim()) payload.renameTo = renameTo.trim();
      if (categoryId) payload.categoryId = categoryId;

      payload.tags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (person) payload.person = person;
      if (paymentType) payload.paymentType = paymentType;
      if (wallet) payload.wallet = wallet;

      if (target === "INCOME") {
        if (!incomeType) {
          setStatusMsg("Para alvo INCOME, selecione o tipo de entrada (incomeType).");
          setLoading(false);
          return;
        }
        payload.incomeType = incomeType;
      }

      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await safeJson(res);

      if (!json.ok) {
        setStatusMsg(json.error || "Erro ao criar regra.");
        setLoading(false);
        return;
      }

      setStatusMsg("Regra adicionada ✅");

      // reset form (mantém target/matchType/priority)
      setPattern("");
      setRenameTo("");
      setCategoryId("");
      setTags("");
      setPerson("");
      setPaymentType("");
      setWallet("");
      setIncomeType("");

      await load();
    } catch (e: any) {
      setStatusMsg(e?.message || "Falha ao criar regra.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Desativar regra?")) return;
    setLoading(true);
    setStatusMsg("");
    try {
      const res = await fetch(`/api/rules/${id}`, { method: "DELETE" });
      const json = await safeJson(res);
      if (!json.ok) setStatusMsg(json.error || "Erro ao desativar regra.");
      else setStatusMsg("Regra desativada ✅");
      await load();
    } catch (e: any) {
      setStatusMsg(e?.message || "Falha ao desativar regra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="bg-white rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Automações (Regras / Tags)</h2>
        <p className="text-sm text-zinc-600 mt-1">
          Use regras para renomear descrições e aplicar categoria/tags/pessoa/carteira automaticamente no import.
        </p>

        {statusMsg && (
          <div className="mt-3 border rounded-lg p-3 text-sm bg-zinc-50">
            {statusMsg}
          </div>
        )}

        <form onSubmit={create} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">Alvo</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={target} onChange={(e) => setTarget(e.target.value as any)}>
              <option value="TRANSACTION">Gastos/Transações</option>
              <option value="INCOME">Entradas (Income)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Tipo de match</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={matchType} onChange={(e) => setMatchType(e.target.value as any)}>
              <option value="CONTAINS">Contém</option>
              <option value="STARTS_WITH">Começa com</option>
              <option value="REGEX">Regex</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Prioridade</label>
            <input className="mt-1 w-full border rounded-lg p-2" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
            <div className="text-xs text-zinc-500 mt-1">Menor aplica primeiro (ex.: 10 &gt; 100).</div>
          </div>

          <div className="md:col-span-3">
            <label className="text-sm font-medium">Padrão</label>
            <input className="mt-1 w-full border rounded-lg p-2" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="Ex.: dm*spotify" />
          </div>

          <div>
            <label className="text-sm font-medium">Renomear para</label>
            <input className="mt-1 w-full border rounded-lg p-2" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} placeholder="Ex.: Spotify" />
          </div>

          <div>
            <label className="text-sm font-medium">Categoria</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">(nenhuma)</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Tags (vírgula)</label>
            <input className="mt-1 w-full border rounded-lg p-2" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Ex.: Lazer, Streaming" />
          </div>

          <div>
            <label className="text-sm font-medium">Pessoa</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="">(não alterar)</option>
              <option value="AMBOS">Ambos</option>
              <option value="PEDRO">Pedro</option>
              <option value="MIRELA">Mirela</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Tipo</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
              <option value="">(não alterar)</option>
              <option value="DEBITO_PIX">Débito/PIX</option>
              <option value="CREDITO_A_VISTA">Crédito à vista</option>
              <option value="PARCELADO">Parcelado</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Carteira</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={wallet} onChange={(e) => setWallet(e.target.value)}>
              <option value="">(não alterar)</option>
              <option value="SALARIO">Salário</option>
              <option value="VALE_ALIMENTACAO">Vale</option>
              <option value="OUTROS">Outros</option>
            </select>
          </div>

          {target === "INCOME" && (
            <div className="md:col-span-3">
              <label className="text-sm font-medium">Tipo de entrada (Income)</label>
              <select className="mt-1 w-full border rounded-lg p-2" value={incomeType} onChange={(e) => setIncomeType(e.target.value)}>
                <option value="">(obrigatório para INCOME)</option>
                <option value="SALARIO">Salário</option>
                <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                <option value="OUTROS">Outros</option>
                <option value="RESTANTE_MES_ANTERIOR">Restante Mês Anterior</option>
              </select>
            </div>
          )}

          <div className="md:col-span-3">
            <button className="border rounded-lg px-4 py-2 bg-zinc-900 text-white disabled:opacity-50" disabled={!pattern.trim() || loading}>
              {loading ? "Salvando..." : "Adicionar Regra"}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl border p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Regras cadastradas</h3>
          <button className="text-sm underline" onClick={load} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">
                  [{r.target}] {r.matchType} • <span className="text-zinc-700">{r.pattern}</span> • pri {r.priority}
                </div>
                <div className="text-xs text-zinc-600 mt-1">
                  {r.renameTo ? `Rename: ${r.renameTo} • ` : ""}
                  {r.categoryId ? `CategoriaId: ${r.categoryId} • ` : ""}
                  {r.tags?.length ? `Tags: ${r.tags.join(", ")} • ` : ""}
                  {r.person ? `Pessoa: ${r.person} • ` : ""}
                  {r.paymentType ? `Tipo: ${r.paymentType} • ` : ""}
                  {r.wallet ? `Carteira: ${r.wallet} • ` : ""}
                  {r.incomeType ? `Income: ${r.incomeType}` : ""}
                </div>
              </div>
              <button className="text-sm underline" onClick={() => remove(r.id)}>Desativar</button>
            </div>
          ))}
          {rules.length === 0 && <div className="text-sm text-zinc-600">Nenhuma regra ainda.</div>}
        </div>
      </section>
    </main>
  );
}
