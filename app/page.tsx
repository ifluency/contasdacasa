import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Person = "PEDRO" | "MIRELA";

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

  return keys.slice(0, 36);
}

function sumCents(arr: { amountCents: number }[]): number {
  let s = 0;
  for (const a of arr) s += a.amountCents || 0;
  return s;
}

function isExpense(amountCents: number) {
  // Se você usa despesas positivas em algum CSV, ajuste aqui.
  // Hoje a conta costuma vir negativa e cartão positivo; mas na prática você controla pelo paymentType+wallet.
  return true;
}

function filterPersonTx(allTx: any[], person: Person) {
  return allTx.filter((t) => t.person === person);
}

function filterByType(allTx: any[], type: string) {
  return allTx.filter((t) => t.paymentType === type);
}

function centsAbs(n: number) {
  return Math.abs(n);
}

function safeName(t: any) {
  return (t.normalized?.trim() ? t.normalized : t.description) as string;
}

function formatDateBR(iso: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(iso);
}

export default async function Page({ searchParams }: { searchParams?: { mes?: string } }) {
  const options = await getMonthOptions();
  const monthKey =
    searchParams?.mes && options.includes(searchParams.mes) ? searchParams.mes : options[0];

  // Entradas do mês (Income)
  const incomes = await prisma.income.findMany({
    where: { monthKey },
    orderBy: [{ person: "asc" }, { type: "asc" }]
  });

  const incomeByPerson: Record<string, { salario: number; vale: number; outros: number; restante: number; total: number }> = {
    PEDRO: { salario: 0, vale: 0, outros: 0, restante: 0, total: 0 },
    MIRELA: { salario: 0, vale: 0, outros: 0, restante: 0, total: 0 }
  };

  for (const inc of incomes) {
    const p = inc.person as any;
    if (p !== "PEDRO" && p !== "MIRELA") continue;

    if (inc.type === "SALARIO") incomeByPerson[p].salario += inc.amountCents;
    else if (inc.type === "VALE_ALIMENTACAO") incomeByPerson[p].vale += inc.amountCents;
    else if (inc.type === "OUTROS") incomeByPerson[p].outros += inc.amountCents;
    else if (inc.type === "RESTANTE_MES_ANTERIOR") incomeByPerson[p].restante += inc.amountCents;
    incomeByPerson[p].total += inc.amountCents;
  }

  // Transações do mês (inclui categorias)
  const tx = await prisma.transaction.findMany({
    where: { monthKey },
    include: { category: true },
    orderBy: [{ occurredAt: "desc" }, { importedAt: "desc" }],
    take: 2000
  });

  // Ignorar não entra em gastos (ex.: pagamento fatura, caixinha, etc.)
  const txEffective = tx.filter((t) => t.paymentType !== "IGNORAR");

  // Contas fixas divididas (assumindo: AMBOS + group "Saídas Fixas")
  const fixedShared = txEffective.filter(
    (t) => t.person === "AMBOS" && (t.category?.groupName || "") === "Saídas Fixas"
  );

  const fixedSharedTotal = sumCents(fixedShared.map((t) => ({ amountCents: centsAbs(t.amountCents) })));
  const fixedSharedHalf = Math.round(fixedSharedTotal / 2);

  // Totais por pessoa (sem incluir fixas compartilhadas automaticamente; vamos mostrar separado e você decide)
  function computePersonSummary(person: Person) {
    const pTx = filterPersonTx(txEffective, person);

    const debit = filterByType(pTx, "DEBITO_PIX");
    const credit = filterByType(pTx, "CREDITO_A_VISTA");
    const parcel = filterByType(pTx, "PARCELADO");

    const debitTotal = sumCents(debit.map((t) => ({ amountCents: centsAbs(t.amountCents) })));
    const creditTotal = sumCents(credit.map((t) => ({ amountCents: centsAbs(t.amountCents) })));
    const parcelTotal = sumCents(parcel.map((t) => ({ amountCents: centsAbs(t.amountCents) })));

    const custosAVista = debitTotal + creditTotal;
    const custosParcelados = parcelTotal;
    const gastosTotais = custosAVista + custosParcelados;

    const entradas = incomeByPerson[person].total;

    // saldo restante (como planilha): entradas - gastos - metade das fixas divididas
    const saldoRestante = entradas - gastosTotais - fixedSharedHalf;

    return {
      debit,
      credit,
      parcel,
      debitTotal,
      creditTotal,
      parcelTotal,
      custosAVista,
      custosParcelados,
      gastosTotais,
      entradas,
      saldoRestante
    };
  }

  const mirela = computePersonSummary("MIRELA");
  const pedro = computePersonSummary("PEDRO");

  // Renda conjunta do mês
  const rendaConjunta = incomeByPerson.PEDRO.total + incomeByPerson.MIRELA.total;
  const pctPedro = rendaConjunta ? (incomeByPerson.PEDRO.total / rendaConjunta) : 0;
  const pctMirela = rendaConjunta ? (incomeByPerson.MIRELA.total / rendaConjunta) : 0;

  function TxTable({
    title,
    rows,
    showParcelInfo
  }: {
    title: string;
    rows: any[];
    showParcelInfo?: boolean;
  }) {
    return (
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-zinc-100 px-3 py-2 text-xs font-semibold">{title}</div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50">
              <tr className="text-left">
                <th className="p-2">Descrição</th>
                <th className="p-2 w-[110px] text-right">Valor (R$)</th>
                {showParcelInfo ? <th className="p-2 w-[90px] text-right">Parcela</th> : null}
                <th className="p-2 w-[140px]">Cat</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, 30).map((t) => (
                <tr key={t.id}>
                  <td className="p-2">
                    <div className="font-medium">{safeName(t)}</div>
                    <div className="text-[10px] text-zinc-500">{formatDateBR(t.occurredAt)}</div>
                  </td>
                  <td className="p-2 text-right font-semibold whitespace-nowrap">{formatBRL(centsAbs(t.amountCents))}</td>
                  {showParcelInfo ? (
                    <td className="p-2 text-right whitespace-nowrap">
                      {t.installmentCurrent && t.installmentTotal ? `${t.installmentCurrent}/${t.installmentTotal}` : "-"}
                    </td>
                  ) : null}
                  <td className="p-2">
                    {t.category ? `${t.category.groupName} — ${t.category.name}` : "-"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="p-3 text-zinc-500" colSpan={showParcelInfo ? 4 : 3}>
                    Sem itens.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {rows.length > 30 ? (
          <div className="px-3 py-2 text-[10px] text-zinc-500 bg-zinc-50">
            Mostrando 30 de {rows.length}.
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="space-y-4">
      {/* Header + filtro mes/ano */}
      <section className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Resumo</h2>
            <p className="text-sm text-zinc-600">
              {monthLabel(monthKey)}
            </p>
          </div>

          <form action="/" className="flex items-center gap-2">
            <label className="text-sm text-zinc-700">Mês/Ano</label>
            <select name="mes" defaultValue={monthKey} className="border rounded-lg p-2 text-sm">
              {options.map((k) => (
                <option key={k} value={k}>{monthLabel(k)}</option>
              ))}
            </select>
            <button className="border rounded-lg px-3 py-2 text-sm bg-zinc-900 text-white">
              Aplicar
            </button>
          </form>
        </div>
      </section>

      {/* Layout estilo planilha */}
      <section className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Sidebar (como a planilha) */}
        <div className="space-y-4">
          {/* SALÁRIOS */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="bg-emerald-100 px-4 py-2 font-semibold text-sm">SALÁRIOS</div>
            <div className="p-4 text-sm space-y-3">
              <div className="flex justify-between">
                <span className="font-medium">Pedro</span>
                <span className="font-semibold">{formatBRL(incomeByPerson.PEDRO.total)}</span>
              </div>
              <div className="text-xs text-zinc-600 ml-2 space-y-1">
                <div className="flex justify-between"><span>Salário</span><span>{formatBRL(incomeByPerson.PEDRO.salario)}</span></div>
                <div className="flex justify-between"><span>Vale</span><span>{formatBRL(incomeByPerson.PEDRO.vale)}</span></div>
                <div className="flex justify-between"><span>Outros</span><span>{formatBRL(incomeByPerson.PEDRO.outros)}</span></div>
                <div className="flex justify-between"><span>Restante</span><span>{formatBRL(incomeByPerson.PEDRO.restante)}</span></div>
              </div>

              <div className="h-px bg-zinc-100" />

              <div className="flex justify-between">
                <span className="font-medium">Mirela</span>
                <span className="font-semibold">{formatBRL(incomeByPerson.MIRELA.total)}</span>
              </div>
              <div className="text-xs text-zinc-600 ml-2 space-y-1">
                <div className="flex justify-between"><span>Salário</span><span>{formatBRL(incomeByPerson.MIRELA.salario)}</span></div>
                <div className="flex justify-between"><span>Vale</span><span>{formatBRL(incomeByPerson.MIRELA.vale)}</span></div>
                <div className="flex justify-between"><span>Outros</span><span>{formatBRL(incomeByPerson.MIRELA.outros)}</span></div>
                <div className="flex justify-between"><span>Restante</span><span>{formatBRL(incomeByPerson.MIRELA.restante)}</span></div>
              </div>

              <div className="h-px bg-zinc-100" />

              <div className="text-xs text-zinc-600">
                <div className="flex justify-between">
                  <span>Renda conjunta do mês</span>
                  <span className="font-semibold">{formatBRL(rendaConjunta)}</span>
                </div>
                <div className="flex justify-between">
                  <span>% Pedro</span>
                  <span className="font-semibold">{(pctPedro * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>% Mirela</span>
                  <span className="font-semibold">{(pctMirela * 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* CONTAS FIXAS DIVIDIDAS */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="bg-sky-100 px-4 py-2 font-semibold text-sm">CONTAS FIXAS DIVIDIDAS</div>

            <div className="overflow-auto max-h-[380px]">
              <table className="w-full text-xs">
                <thead className="bg-sky-50">
                  <tr className="text-left">
                    <th className="p-2">Descrição</th>
                    <th className="p-2 w-[110px] text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fixedShared.map((t) => (
                    <tr key={t.id}>
                      <td className="p-2">
                        <div className="font-medium">{safeName(t)}</div>
                        <div className="text-[10px] text-zinc-500">{t.category ? t.category.name : "-"}</div>
                      </td>
                      <td className="p-2 text-right font-semibold whitespace-nowrap">{formatBRL(centsAbs(t.amountCents))}</td>
                    </tr>
                  ))}
                  {fixedShared.length === 0 ? (
                    <tr>
                      <td className="p-3 text-zinc-500" colSpan={2}>Sem contas fixas no mês (critério: AMBOS + Saídas Fixas).</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-sky-50 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold">TOTAL</span>
                <span className="font-semibold">{formatBRL(fixedSharedTotal)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-semibold">DIVISÃO</span>
                <span className="font-semibold">{formatBRL(fixedSharedHalf)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Painéis Mirela e Pedro */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* MIRELA */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="bg-violet-100 px-4 py-2 font-semibold text-sm text-center">MIRELA</div>

            <div className="p-4 grid grid-cols-2 gap-3 text-sm">
              <div className="border rounded-lg p-3">
                <div className="text-xs text-zinc-600">Custos à vista</div>
                <div className="font-semibold">{formatBRL(mirela.custosAVista)}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-zinc-600">Custos parcelados</div>
                <div className="font-semibold">{formatBRL(mirela.custosParcelados)}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-zinc-600">Gastos totais</div>
                <div className="font-semibold">{formatBRL(mirela.gastosTotais)}</div>
              </div>
              <div className="border rounded-lg p-3 bg-emerald-50">
                <div className="text-xs text-zinc-600">Saldo restante</div>
                <div className="font-semibold">{formatBRL(mirela.saldoRestante)}</div>
                <div className="text-[10px] text-zinc-500 mt-1">Entradas − Gastos − Divisão fixas</div>
              </div>
            </div>

            <div className="px-4 pb-4 grid grid-cols-1 gap-3">
              <TxTable title="DÉBITO/PIX" rows={mirela.debit} />
              <TxTable title="CRÉDITO À VISTA" rows={mirela.credit} />
              <TxTable title="PARCELADO" rows={mirela.parcel} showParcelInfo />
            </div>
          </div>

          {/* PEDRO */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="bg-rose-100 px-4 py-2 font-semibold text-sm text-center">PEDRO</div>

            <div className="p-4 grid grid-cols-2 gap-3 text-sm">
              <div className="border rounded-lg p-3">
                <div className="text-xs text-zinc-600">Custos à vista</div>
                <div className="font-semibold">{formatBRL(pedro.custosAVista)}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-zinc-600">Custos parcelados</div>
                <div className="font-semibold">{formatBRL(pedro.custosParcelados)}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-zinc-600">Gastos totais</div>
                <div className="font-semibold">{formatBRL(pedro.gastosTotais)}</div>
              </div>
              <div className="border rounded-lg p-3 bg-emerald-50">
                <div className="text-xs text-zinc-600">Saldo restante</div>
                <div className="font-semibold">{formatBRL(pedro.saldoRestante)}</div>
                <div className="text-[10px] text-zinc-500 mt-1">Entradas − Gastos − Divisão fixas</div>
              </div>
            </div>

            <div className="px-4 pb-4 grid grid-cols-1 gap-3">
              <TxTable title="DÉBITO/PIX" rows={pedro.debit} />
              <TxTable title="CRÉDITO À VISTA" rows={pedro.credit} />
              <TxTable title="PARCELADO" rows={pedro.parcel} showParcelInfo />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
