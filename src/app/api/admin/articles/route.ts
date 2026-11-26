import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/slugify";

const ArticleCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  slug: z.string().max(150).optional(),
  subtitle: z.string().max(400).optional().nullable(),
  excerpt: z.string().max(600).optional().nullable(),
  content: z.string().min(1, "Content is required"),
  featuredImage: z.string().max(1000).optional().nullable(),
  imageCaption: z.string().max(400).optional().nullable(),
  imageAlt: z.string().max(250).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED"]).default("DRAFT"),
  isBreaking: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  hideAds: z.boolean().default(false),
  authorName: z.string().max(120).default("धमाका 24*7 संवाददाता"),
  categoryId: z.string().min(1, "Category is required"),
  metaTitle: z.string().max(100).optional().nullable(),
  metaDescription: z.string().max(220).optional().nullable(),
  canonicalUrl: z.string().max(500).optional().nullable(),
  aiSummary: z.string().max(1500).optional().nullable(),
  aiAssisted: z.boolean().default(false),
  scheduledAt: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
});

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let candidate = baseSlug;
  let counter = 1;
  while (await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return candidate;
}

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const categoryId = searchParams.get("categoryId");
  const search = searchParams.get("search")?.trim();
  const trash = searchParams.get("trash") === "true";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {
    deletedAt: trash ? { not: null } : null,
  };
  if (status && status !== "ALL" && !trash) {
    where.status = status;
  }
  if (categoryId && categoryId !== "ALL") {
    where.categoryId = categoryId;
  }
  if (search) {
    where.title = { contains: search };
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }

  const articles = await prisma.article.findMany({
    where,
    orderBy: trash ? { deletedAt: "desc" } : { updatedAt: "desc" },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      tags: { include: { tag: true } },
    },
    take: 100,
  });

  return NextResponse.json({ articles });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = ArticleCreateSchema.parse(body);

    const rawSlug = data.slug?.trim() ? slugify(data.slug) : slugify(data.title);
    const uniqueSlug = await ensureUniqueSlug(rawSlug);
    const cleanContent = sanitizeArticleHtml(data.content);

    const publishedAt = data.status === "PUBLISHED" ? new Date() : null;
    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;

    const article = await prisma.article.create({
      data: {
        title: data.title,
        slug: uniqueSlug,
        subtitle: data.subtitle || null,
        excerpt: data.excerpt || null,
        content: cleanContent,
        featuredImage: data.featuredImage || null,
        imageCaption: data.imageCaption || null,
        imageAlt: data.imageAlt || null,
        status: data.status,
        isBreaking: data.isBreaking,
        isFeatured: data.isFeatured,
        hideAds: data.hideAds,
        authorName: data.authorName || "धमाका 24*7 संवाददाता",
        categoryId: data.categoryId,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        canonicalUrl: data.canonicalUrl || null,
        aiSummary: data.aiSummary || null,
        aiAssisted: data.aiAssisted,
        publishedAt,
        scheduledAt,
      },
      include: { category: true },
    });

    // Attach tags
    for (const rawTag of data.tags) {
      const name = rawTag.trim();
      if (!name) continue;
      const tSlug = slugify(name, "tag");
      const tag = await prisma.tag.upsert({
        where: { slug: tSlug },
        update: {},
        create: { name, slug: tSlug },
      });
      await prisma.articleTag.upsert({
        where: { articleId_tagId: { articleId: article.id, tagId: tag.id } },
        update: {},
        create: { articleId: article.id, tagId: tag.id },
      });
    }

    if (article.status === "PUBLISHED") {
      revalidatePath("/");
      revalidatePath(`/news/${article.slug}`);
      revalidatePath(`/category/${article.category.slug}`);
    }

    return NextResponse.json({ article }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
  }
}
