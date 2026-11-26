import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

const CategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().max(100).optional(),
  parentId: z.string().optional().nullable(),
  order: z.number().int().default(0),
});

const CategoryUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().max(100).optional(),
  parentId: z.string().optional().nullable(),
  order: z.number().int().optional(),
});

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await prisma.category.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { articles: true } },
    },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = CategoryCreateSchema.parse(body);
    const slug = data.slug?.trim() ? slugify(data.slug, "cat") : slugify(data.name, "cat");

    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug,
        parentId: data.parentId || null,
        order: data.order,
      },
    });
    revalidatePath("/");
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create category (slug may already exist)" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = CategoryUpdateSchema.parse(body);
    const category = await prisma.category.update({
      where: { id: data.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: slugify(data.slug, "cat") } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId || null } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
      },
    });
    revalidatePath("/");
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ error: "Failed to update category" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const count = await prisma.article.count({ where: { categoryId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: "Cannot delete category that still has articles. Reassign them first." },
      { status: 400 }
    );
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
