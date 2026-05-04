import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));

  const updated = await prisma.rule.update({
    where: { id: params.id },
    data: {
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      target: body.target !== undefined ? body.target : undefined,
      matchType: body.matchType !== undefined ? body.matchType : undefined,
      pattern: body.pattern !== undefined ? String(body.pattern).trim() : undefined,
      priority: body.priority !== undefined ? Number(body.priority) : undefined,

      renameTo: body.renameTo !== undefined ? (body.renameTo ? String(body.renameTo).trim() : null) : undefined,
      categoryId: body.categoryId !== undefined ? (body.categoryId || null) : undefined,

      tags: body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags.map(String) : []) : undefined,

      person: body.person !== undefined ? (body.person || null) : undefined,
      paymentType: body.paymentType !== undefined ? (body.paymentType || null) : undefined,
      wallet: body.wallet !== undefined ? (body.wallet || null) : undefined,

      incomeType: body.incomeType !== undefined ? (body.incomeType || null) : undefined
    }
  });

  return NextResponse.json({ ok: true, item: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.rule.update({
    where: { id: params.id },
    data: { isActive: false }
  });

  return NextResponse.json({ ok: true });
}
