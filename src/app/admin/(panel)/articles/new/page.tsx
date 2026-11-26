import { prisma } from "@/lib/prisma";
import { ArticleForm } from "@/components/admin/ArticleForm";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Write New Article</h1>
      <ArticleForm categories={categories} />
    </div>
  );
}
