import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArticleForm } from "@/components/admin/ArticleForm";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [article, categories] = await Promise.all([
    prisma.article.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    }),
    prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    }),
  ]);

  if (!article) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Edit Article</h1>
      <ArticleForm
        categories={categories}
        initialData={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          subtitle: article.subtitle ?? "",
          excerpt: article.excerpt ?? "",
          content: article.content,
          featuredImage: article.featuredImage ?? "",
          imageCaption: article.imageCaption ?? "",
          imageAlt: article.imageAlt ?? "",
          status: article.status as "DRAFT" | "PUBLISHED" | "UNPUBLISHED",
          isBreaking: article.isBreaking,
          isFeatured: article.isFeatured,
          hideAds: article.hideAds,
          authorName: article.authorName,
          categoryId: article.categoryId,
          metaTitle: article.metaTitle ?? "",
          metaDescription: article.metaDescription ?? "",
          canonicalUrl: article.canonicalUrl ?? "",
          aiSummary: article.aiSummary ?? "",
          aiAssisted: article.aiAssisted,
          scheduledAt: article.scheduledAt
            ? new Date(article.scheduledAt).toISOString().slice(0, 16)
            : "",
          tagsText: article.tags.map((t) => t.tag.name).join(", "),
        }}
      />
    </div>
  );
}
