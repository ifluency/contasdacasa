import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      person: body.person !== undefined ? body.person : undefined,
      wallet: body.wallet !== undefined ? body.wallet : undefined,
      paymentType: body.paymentType !== undefined ? body.paymentType : undefined,
      categoryId: body.categoryId !== undefined ? (body.categoryId || null) : undefined,
      tags: body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags.map(String) : []) : undefined,
      normalized: body.normalized !== undefined ? (body.normalized ? String(body.normalized) : null) : undefined
    }
  });

  return NextResponse.json({ ok: true, item: updated });
}
