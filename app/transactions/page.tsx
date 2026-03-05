import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatBRL(cents: number): string {
  const v = cents / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isMissingTableError(err: unknown): boolean {
  const msg = (err as any)?.message?.toString?.() ?? "";
  return msg.includes("does not exist") && msg.includes("Transaction");
}

export default async function TransactionsPage() {
  try {
    const tx = await prisma.transaction.findMany({
      orderBy: { occurredAt: "desc" },
      take: 200
    });

    return (
      <main className="space-y-6">
        <section className="bg-white rounded-xl border p-5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">Transações</h2>
            <div className="text-sm text-zinc-600">{tx.length} (mostrando até 200)</div>
          </div>

          <div className="mt-4 overflow-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-100">
                <tr className="text-left">
                  <th className="p-3">Data</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Origem</th>
                  <th className="p-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tx.map((t) => (
                  <tr key={t.id}>
                    <td className="p-3 whitespace-nowrap">
                      {new Intl.DateTimeFormat("pt-BR").format(t.occurredAt)}
                    </td>
                    <td className="p-3">{t.description}</td>
                    <td className="p-3">{t.categoryRaw ?? "-"}</td>
                    <td className="p-3">{t.source}</td>
                    <td className="p-3 text-right font-semibold whitespace-nowrap">
                      {formatBRL(t.amountCents)}
                    </td>
                  </tr>
                ))}

                {tx.length === 0 && (
                  <tr>
                    <td className="p-4 text-zinc-600" colSpan={5}>
                      Nenhuma transação ainda. Vá em{" "}
                      <a className="underline" href="/import">Importar CSV</a>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  } catch (err) {
    if (isMissingTableError(err)) {
      return (
        <main className="space-y-6">
          <section className="bg-white rounded-xl border p-5">
            <h2 className="text-lg font-semibold">Transações</h2>
            <p className="text-sm text-zinc-600 mt-2">
              A tabela ainda não existe no banco (migrations não aplicadas).
            </p>
            <ol className="list-decimal ml-5 mt-3 text-sm text-zinc-700 space-y-1">
              <li>Garanta que a variável <code>DATABASE_URL</code> está apontando para o banco correto na Vercel.</li>
              <li>Rode e commit as migrations: <code>npx prisma migrate dev --name init</code></li>
              <li>Confirme que o build está rodando: <code>prisma migrate deploy</code> antes do <code>next build</code>.</li>
            </ol>
          </section>
        </main>
      );
    }

    throw err;
  }
}
