import { prisma } from "@/lib/db";

function formatBRL(cents: number): string {
  const v = cents / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function Page() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

  const monthTx = await prisma.transaction.findMany({
    where: { occurredAt: { gte: start, lt: end } },
    orderBy: { occurredAt: "desc" },
    take: 8
  });

  const agg = await prisma.transaction.aggregate({
    where: { occurredAt: { gte: start, lt: end } },
    _sum: { amountCents: true },
    _count: true
  });

  return (
    <main className="space-y-6">
      <section className="bg-white rounded-xl border p-5">
        <h2 className="text-lg font-semibold mb-1">Resumo do mês</h2>
        <p className="text-sm text-zinc-600">
          {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(now)}
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-zinc-500">Transações</div>
            <div className="text-xl font-semibold">{agg._count}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-zinc-500">Total (somatório)</div>
            <div className="text-xl font-semibold">{formatBRL(agg._sum.amountCents ?? 0)}</div>
            <div className="text-xs text-zinc-500 mt-1">
              Despesa costuma vir negativa (depende do CSV).
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-zinc-500">Ação</div>
            <a className="inline-block mt-2 underline" href="/import">
              Importar fatura Nubank
            </a>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border p-5">
        <h2 className="text-lg font-semibold mb-3">Últimas transações</h2>
        <div className="divide-y">
          {monthTx.map((t) => (
            <div key={t.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{t.description}</div>
                <div className="text-xs text-zinc-500">
                  {new Intl.DateTimeFormat("pt-BR").format(t.occurredAt)} • {t.source}{t.categoryRaw ? ` • ${t.categoryRaw}` : ""}
                </div>
              </div>
              <div className="font-semibold whitespace-nowrap">{formatBRL(t.amountCents)}</div>
            </div>
          ))}
          {monthTx.length === 0 && (
            <div className="py-6 text-sm text-zinc-600">
              Nenhuma transação no mês. Vá em <a className="underline" href="/import">Importar CSV</a>.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
