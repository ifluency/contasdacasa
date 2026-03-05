import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));

  const updated = await prisma.category.update({
    where: { id: params.id },
    data: {
      groupName: body.groupName !== undefined ? String(body.groupName).trim() : undefined,
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      person: body.person !== undefined ? body.person : undefined,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined
    }
  });

  return NextResponse.json({ ok: true, item: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.category.update({
    where: { id: params.id },
    data: { isActive: false }
  });
  return NextResponse.json({ ok: true });
}
