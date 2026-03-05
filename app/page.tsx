import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(d);
}

async function getMonthOptions(): Promise<string[]> {
  const rows = await prisma.transaction.findMany({
    select: { monthKey: true },
    distinct: ["monthKey"],
    orderBy: { monthKey: "desc" }
  });

  const keys = rows.map((r) => r.monthKey);
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (!keys.includes(current)) keys.unshift(current);

  return keys.slice(0, 24);
}

export default async function Page({ searchParams }: { searchParams?: { mes?: string } }) {
  const options = await getMonthOptions();
  const monthKey = (searchParams?.mes && options.includes(searchParams.mes)) ? searchParams.mes : options[0];

  const tx = await prisma.transaction.findMany({
    where: { monthKey },
    orderBy: { occurredAt: "desc" },
    take: 10
  });

  const totalsByType = await prisma.transaction.groupBy({
    by: ["paymentType"],
    where: { monthKey },
    _sum: { amountCents: true },
    _count: true
  });

  const totalsByPerson = await prisma.transaction.groupBy({
    by: ["person"],
    where: { monthKey },
    _sum: { amountCents: true },
    _count: true
  });

  return (
    <main className="space-y-6">
      <section className="bg-white rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Dashboard</h2>
            <p className="text-sm text-zinc-600 mt-1">Competência: <span className="font-medium">{monthLabel(monthKey)}</span></p>
          </div>

          <form action="/" className="flex items-center gap-2">
            <label className="text-sm text-zinc-700">Mês/Ano</label>
            <select name="mes" defaultValue={monthKey} className="border rounded-lg p-2 text-sm">
              {options.map((k) => (
                <option key={k} value={k}>{monthLabel(k)}</option>
              ))}
            </select>
            <button className="border rounded-lg px-3 py-2 text-sm bg-zinc-900 text-white">Aplicar</button>
          </form>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-zinc-500">Por tipo</div>
            <div className="mt-2 space-y-1 text-sm">
              {totalsByType.map((r) => (
                <div key={r.paymentType} className="flex justify-between gap-3">
                  <span>{r.paymentType}</span>
                  <span className="font-semibold">{formatBRL(r._sum.amountCents ?? 0)}</span>
                </div>
              ))}
              {totalsByType.length === 0 && <div className="text-zinc-600">Sem dados.</div>}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-xs text-zinc-500">Por pessoa</div>
            <div className="mt-2 space-y-1 text-sm">
              {totalsByPerson.map((r) => (
                <div key={r.person} className="flex justify-between gap-3">
                  <span>{r.person}</span>
                  <span className="font-semibold">{formatBRL(r._sum.amountCents ?? 0)}</span>
                </div>
              ))}
              {totalsByPerson.length === 0 && <div className="text-zinc-600">Sem dados.</div>}
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-xs text-zinc-500">Ações</div>
            <div className="mt-2 flex flex-col gap-2 text-sm">
              <a className="underline" href="/import">Importar CSV</a>
              <a className="underline" href={`/transactions?mes=${monthKey}`}>Ver transações do mês</a>
              <a className="underline" href="/categories">Editar categorias</a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold mb-3">Últimas transações</h3>
        <div className="divide-y">
          {tx.map((t) => (
            <div key={t.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {t.description}
                  {t.installmentCurrent && t.installmentTotal ? (
                    <span className="text-xs text-zinc-500"> • Parcela {t.installmentCurrent}/{t.installmentTotal}</span>
                  ) : null}
                </div>
                <div className="text-xs text-zinc-500">
                  {new Intl.DateTimeFormat("pt-BR").format(t.occurredAt)} • {t.person} • {t.paymentType}
                </div>
              </div>
              <div className="font-semibold whitespace-nowrap">{formatBRL(t.amountCents)}</div>
            </div>
          ))}
          {tx.length === 0 && (
            <div className="py-6 text-sm text-zinc-600">
              Nenhuma transação nesse mês. Vá em <a className="underline" href="/import">Importar CSV</a>.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
