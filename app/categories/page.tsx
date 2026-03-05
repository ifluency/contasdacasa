"use client";

import { useEffect, useMemo, useState } from "react";

type Category = {
  id: string;
  groupName: string;
  name: string;
  person: "PEDRO" | "MIRELA" | "AMBOS" | null;
  isActive: boolean;
};

const GROUPS = [
  "Saídas Fixas",
  "Saídas Alimentação",
  "Saídas Transporte",
  "Saídas Saúde",
  "Saídas Educação",
  "Saídas Lazer",
  "Saídas Casa",
  "Saídas Pessoais"
];

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const [groupName, setGroupName] = useState(GROUPS[0]);
  const [name, setName] = useState("");
  const [person, setPerson] = useState<"AMBOS" | "PEDRO" | "MIRELA" | "">("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/categories");
    const json = await res.json();
    setItems(json.items || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of items) {
      const key = c.groupName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { groupName, name };
    if (person) payload.person = person;

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.ok) {
      alert(json.error || "Erro ao criar categoria.");
      return;
    }
    setName("");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Remover categoria?")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main className="space-y-6">
      <section className="bg-white rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Categorias</h2>
        <p className="text-sm text-zinc-600 mt-1">
          Edite e mantenha os grupos/subgrupos para classificar as saídas.
        </p>

        <form onSubmit={addCategory} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-sm font-medium">Grupo</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={groupName} onChange={(e) => setGroupName(e.target.value)}>
              {GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Subcategoria</label>
            <input className="mt-1 w-full border rounded-lg p-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Aluguel" />
          </div>

          <div>
            <label className="text-sm font-medium">Pessoa (opcional)</label>
            <select className="mt-1 w-full border rounded-lg p-2" value={person} onChange={(e) => setPerson(e.target.value as any)}>
              <option value="">Geral</option>
              <option value="AMBOS">Ambos</option>
              <option value="PEDRO">Pedro</option>
              <option value="MIRELA">Mirela</option>
            </select>
          </div>

          <button className="border rounded-lg px-4 py-2 bg-zinc-900 text-white disabled:opacity-50" disabled={!name.trim() || loading}>
            Adicionar
          </button>
        </form>
      </section>

      <section className="bg-white rounded-xl border p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Lista</h3>
          <button className="text-sm underline" onClick={load} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        <div className="mt-4 space-y-6">
          {grouped.map(([g, cats]) => (
            <div key={g}>
              <div className="font-semibold mb-2">{g}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {cats.map((c) => (
                  <div key={c.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-zinc-500">Pessoa: {c.person ?? "Geral"}</div>
                    </div>
                    <button className="text-sm underline" onClick={() => remove(c.id)}>Remover</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="text-sm text-zinc-600">Nenhuma categoria ainda.</div>}
        </div>
      </section>
    </main>
  );
}
