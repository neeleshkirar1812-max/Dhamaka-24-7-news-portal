import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_ARTICLE_WHERE } from "@/lib/news-queries";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(20, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "10", 10) || 10));
  const categorySlug = searchParams.get("category");

  let categoryIds: string[] | undefined;
  if (categorySlug) {
    const cat = await prisma.category.findUnique({
      where: { slug: categorySlug },
      include: { children: { select: { id: true } } },
    });
    if (cat) {
      categoryIds = [cat.id, ...cat.children.map((c) => c.id)];
    }
  }

  const articles = await prisma.article.findMany({
    where: {
      ...PUBLIC_ARTICLE_WHERE,
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    skip: offset,
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
      imageAlt: true,
      publishedAt: true,
      createdAt: true,
      category: { select: { name: true, slug: true } },
    },
  });

  return NextResponse.json({ articles });
}
