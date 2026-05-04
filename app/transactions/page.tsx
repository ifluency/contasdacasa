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

export default async function TransactionsPage({
  searchParams
}: {
  searchParams?: { mes?: string; tipo?: string; pessoa?: string };
}) {
  const options = await getMonthOptions();
  const monthKey = (searchParams?.mes && options.includes(searchParams.mes)) ? searchParams.mes : options[0];

  const tipo = (searchParams?.tipo || "ALL").toUpperCase(); // ALL | DEBITO_PIX | CREDITO_A_VISTA | PARCELADO
  const pessoa = (searchParams?.pessoa || "ALL").toUpperCase(); // ALL | PEDRO | MIRELA | AMBOS

  const where: any = { monthKey };
  if (tipo !== "ALL") where.paymentType = tipo;
  if (pessoa !== "ALL") where.person = pessoa;

  const tx = await prisma.transaction.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { importedAt: "desc" }],
    take: 400
  });

  return (
    <main className="space-y-6">
      <section className="bg-white rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Transações</h2>
            <p className="text-sm text-zinc-600 mt-1">
              {monthLabel(monthKey)} • {tx.length} (até 400)
            </p>
          </div>

          <form action="/transactions" className="flex flex-wrap items-center gap-2">
            <select name="mes" defaultValue={monthKey} className="border rounded-lg p-2 text-sm">
              {options.map((k) => (
                <option key={k} value={k}>{monthLabel(k)}</option>
              ))}
            </select>

            <select name="tipo" defaultValue={tipo} className="border rounded-lg p-2 text-sm">
              <option value="ALL">Todos</option>
              <option value="DEBITO_PIX">Débito/PIX</option>
              <option value="CREDITO_A_VISTA">Crédito à vista</option>
              <option value="PARCELADO">Parcelados</option>
            </select>

            <select name="pessoa" defaultValue={pessoa} className="border rounded-lg p-2 text-sm">
              <option value="ALL">Ambos + individuais</option>
              <option value="AMBOS">Ambos</option>
              <option value="PEDRO">Pedro</option>
              <option value="MIRELA">Mirela</option>
            </select>

            <button className="border rounded-lg px-3 py-2 text-sm bg-zinc-900 text-white">Aplicar</button>
          </form>
        </div>

        <div className="mt-4 overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100">
              <tr className="text-left">
                <th className="p-3">Data</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Pessoa</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Parcela</th>
                <th className="p-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tx.map((t) => (
                <tr key={t.id}>
                  <td className="p-3 whitespace-nowrap">{new Intl.DateTimeFormat("pt-BR").format(t.occurredAt)}</td>
                  <td className="p-3">{t.description}</td>
                  <td className="p-3">{t.person}</td>
                  <td className="p-3">{t.paymentType}</td>
                  <td className="p-3">
                    {t.installmentCurrent && t.installmentTotal ? `${t.installmentCurrent}/${t.installmentTotal}` : "-"}
                  </td>
                  <td className="p-3 text-right font-semibold whitespace-nowrap">{formatBRL(t.amountCents)}</td>
                </tr>
              ))}
              {tx.length === 0 && (
                <tr>
                  <td className="p-4 text-zinc-600" colSpan={6}>
                    Nenhuma transação nesse filtro.
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
