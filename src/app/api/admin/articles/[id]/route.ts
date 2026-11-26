import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/slugify";

const ArticlePatchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  slug: z.string().max(150).optional(),
  subtitle: z.string().max(400).optional().nullable(),
  excerpt: z.string().max(600).optional().nullable(),
  content: z.string().min(1).optional(),
  featuredImage: z.string().max(1000).optional().nullable(),
  imageCaption: z.string().max(400).optional().nullable(),
  imageAlt: z.string().max(250).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED"]).optional(),
  isBreaking: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  hideAds: z.boolean().optional(),
  authorName: z.string().max(120).optional(),
  categoryId: z.string().min(1).optional(),
  metaTitle: z.string().max(100).optional().nullable(),
  metaDescription: z.string().max(220).optional().nullable(),
  canonicalUrl: z.string().max(500).optional().nullable(),
  aiSummary: z.string().max(1500).optional().nullable(),
  aiAssisted: z.boolean().optional(),
  scheduledAt: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  restore: z.boolean().optional(),
});

function revalidateArticleRoutes(slug: string, categorySlug?: string | null) {
  revalidatePath("/");
  revalidatePath(`/news/${slug}`);
  if (categorySlug) {
    revalidatePath(`/category/${categorySlug}`);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      category: true,
      tags: { include: { tag: true } },
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  return NextResponse.json({ article });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const existing = await prisma.article.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = ArticlePatchSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined && data.slug.trim()) {
      const nextSlug = slugify(data.slug);
      if (nextSlug !== existing.slug) {
        const collision = await prisma.article.findUnique({ where: { slug: nextSlug } });
        updateData.slug = collision ? `${nextSlug}-${Date.now().toString(36).slice(-4)}` : nextSlug;
      }
    }
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.content !== undefined) updateData.content = sanitizeArticleHtml(data.content);
    if (data.featuredImage !== undefined) updateData.featuredImage = data.featuredImage;
    if (data.imageCaption !== undefined) updateData.imageCaption = data.imageCaption;
    if (data.imageAlt !== undefined) updateData.imageAlt = data.imageAlt;
    if (data.isBreaking !== undefined) updateData.isBreaking = data.isBreaking;
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
    if (data.hideAds !== undefined) updateData.hideAds = data.hideAds;
    if (data.authorName !== undefined) updateData.authorName = data.authorName;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription;
    if (data.canonicalUrl !== undefined) updateData.canonicalUrl = data.canonicalUrl;
    if (data.aiSummary !== undefined) updateData.aiSummary = data.aiSummary;
    if (data.aiAssisted !== undefined) updateData.aiAssisted = data.aiAssisted;
    if (data.scheduledAt !== undefined) {
      updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    }
    if (data.restore) {
      updateData.deletedAt = null;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "PUBLISHED" && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const updated = await prisma.article.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    if (data.tags !== undefined) {
      await prisma.articleTag.deleteMany({ where: { articleId: id } });
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
          where: { articleId_tagId: { articleId: id, tagId: tag.id } },
          update: {},
          create: { articleId: id, tagId: tag.id },
        });
      }
    }

    revalidateArticleRoutes(existing.slug, existing.category.slug);
    revalidateArticleRoutes(updated.slug, updated.category.slug);

    return NextResponse.json({ article: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Validation error" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get("permanent") === "true";

  const existing = await prisma.article.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (permanent || existing.deletedAt) {
    await prisma.article.delete({ where: { id } });
  } else {
    await prisma.article.update({
      where: { id },
      data: { deletedAt: new Date(), status: "UNPUBLISHED" },
    });
  }

  revalidateArticleRoutes(existing.slug, existing.category.slug);
  return NextResponse.json({ ok: true });
}
