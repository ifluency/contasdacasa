import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const target = (searchParams.get("target") || "").trim(); // optional

    const where: any = {};
    if (target) where.target = target;

    const items = await prisma.rule.findMany({
      where,
      orderBy: [{ target: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
      include: { category: true }
    });

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ groupName: "asc" }, { name: "asc" }]
    });

    return NextResponse.json({ ok: true, items, categories });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Erro no GET /api/rules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const target = String(body.target || "").trim(); // TRANSACTION | INCOME
    const matchType = String(body.matchType || "").trim(); // CONTAINS | STARTS_WITH | REGEX
    const pattern = String(body.pattern || "").trim();
    const priority = Number(body.priority ?? 100);

    if (!target || !["TRANSACTION", "INCOME"].includes(target)) {
      return bad("target inválido. Use TRANSACTION ou INCOME.");
    }
    if (!matchType || !["CONTAINS", "STARTS_WITH", "REGEX"].includes(matchType)) {
      return bad("matchType inválido. Use CONTAINS, STARTS_WITH ou REGEX.");
    }
    if (!pattern) return bad("pattern é obrigatório.");
    if (!Number.isFinite(priority)) return bad("priority inválido.");

    // Se for INCOME, incomeType vira obrigatório
    if (target === "INCOME") {
      const incomeType = String(body.incomeType || "").trim();
      if (!incomeType || !["SALARIO", "VALE_ALIMENTACAO", "OUTROS", "RESTANTE_MES_ANTERIOR"].includes(incomeType)) {
        return bad("Para target=INCOME, incomeType é obrigatório e deve ser um valor válido.");
      }
    }

    const tags = Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).trim()).filter(Boolean) : [];

    const created = await prisma.rule.create({
      data: {
        isActive: body.isActive ?? true,
        target: target as any,
        matchType: matchType as any,
        pattern,
        priority,

        renameTo: body.renameTo ? String(body.renameTo).trim() : null,
        categoryId: body.categoryId || null,

        tags,

        person: body.person || null,
        paymentType: body.paymentType || null,
        wallet: body.wallet || null,

        incomeType: body.incomeType || null
      }
    });

    return NextResponse.json({ ok: true, item: created });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Erro no POST /api/rules" }, { status: 500 });
  }
}
