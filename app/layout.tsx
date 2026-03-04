import "./globals.css";

export const metadata = {
  title: "Finanças do Casal",
  description: "Controle financeiro com importação de CSV do Nubank."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-zinc-50 text-zinc-900">
        <div className="max-w-5xl mx-auto p-6">
          <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-xl font-semibold">Finanças do Casal</h1>
              <p className="text-sm text-zinc-600">MVP: importar fatura Nubank (CSV) → transações</p>
            </div>
            <nav className="flex gap-3 text-sm">
              <a className="underline" href="/">Dashboard</a>
              <a className="underline" href="/import">Importar CSV</a>
              <a className="underline" href="/transactions">Transações</a>
            </nav>
          </header>

          {children}

          <footer className="mt-12 text-xs text-zinc-500">
            Deploy na Vercel + Postgres (Neon/Vercel Postgres) + Prisma.
          </footer>
        </div>
      </body>
    </html>
  );
}
