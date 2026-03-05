import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
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
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const created = await prisma.rule.create({
    data: {
      isActive: body.isActive ?? true,
      target: body.target,
      matchType: body.matchType,
      pattern: String(body.pattern || "").trim(),
      priority: Number(body.priority ?? 100),

      renameTo: body.renameTo ? String(body.renameTo).trim() : null,
      categoryId: body.categoryId || null,

      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],

      person: body.person || null,
      paymentType: body.paymentType || null,
      wallet: body.wallet || null,

      incomeType: body.incomeType || null
    }
  });

  return NextResponse.json({ ok: true, item: created });
}
