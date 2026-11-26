import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.tickerItem.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = z
      .object({
        text: z.string().min(1).max(160),
        url: z.string().max(500).optional().nullable(),
        order: z.number().int().default(0),
      })
      .parse(await req.json());

    const item = await prisma.tickerItem.create({
      data: {
        text: data.text,
        url: data.url || null,
        order: data.order,
        isActive: true,
      },
    });
    revalidatePath("/");
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid ticker item" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = z
    .object({ id: z.string().min(1), isActive: z.boolean() })
    .parse(await req.json());

  await prisma.tickerItem.update({
    where: { id: data.id },
    data: { isActive: data.isActive },
  });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.tickerItem.delete({ where: { id } });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
