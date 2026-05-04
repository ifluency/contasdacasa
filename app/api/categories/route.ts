import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const items = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ groupName: "asc" }, { name: "asc" }]
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const groupName = String(body.groupName || "").trim();
  const name = String(body.name || "").trim();
  const person = body.person ?? null;

  if (!groupName || !name) {
    return NextResponse.json({ ok: false, error: "groupName e name são obrigatórios." }, { status: 400 });
  }

  const created = await prisma.category.create({
    data: { groupName, name, person }
  });

  return NextResponse.json({ ok: true, item: created });
}
