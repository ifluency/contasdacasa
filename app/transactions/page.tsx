import { prisma } from "@/lib/db";

function formatBRL(cents: number): string {
  const v = cents / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function TransactionsPage() {
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
                    Nenhuma transação ainda. Vá em <a className="underline" href="/import">Importar CSV</a>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
