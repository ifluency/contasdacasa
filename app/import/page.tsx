"use client";

import { useState } from "react";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("nubank_credit");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("source", source);

    const res = await fetch("/api/import/nubank", { method: "POST", body: fd });
    const json = await res.json();
    setResult({ status: res.status, ...json });
    setLoading(false);
  }

  return (
    <main className="space-y-6">
      <section className="bg-white rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Importar CSV (Nubank)</h2>
        <p className="text-sm text-zinc-600 mt-1">
          Exporte a fatura/lançamentos do Nubank em CSV e envie aqui.
        </p>

        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium">Tipo de origem</label>
            <select
              className="mt-1 w-full border rounded-lg p-2"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="nubank_credit">Nubank (Cartão / Fatura)</option>
              <option value="nubank_account">Nubank (Conta)</option>
            </select>
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

          <button
            disabled={!file || loading}
            className="border rounded-lg px-4 py-2 bg-zinc-900 text-white disabled:opacity-50"
          >
            {loading ? "Importando..." : "Importar"}
          </button>
        </form>
      </section>

      {result && (
        <section className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold">Resultado</h3>
          <pre className="mt-3 text-xs bg-zinc-50 border rounded-lg p-3 overflow-auto">
{JSON.stringify(result, null, 2)}
          </pre>
          {result.ok && (
            <p className="text-sm mt-3">
              Vá em <a className="underline" href="/transactions">Transações</a>.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
