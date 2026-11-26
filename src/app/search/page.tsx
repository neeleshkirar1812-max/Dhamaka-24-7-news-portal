import { prisma } from "@/lib/prisma";
import { PUBLIC_ARTICLE_WHERE } from "@/lib/news-queries";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { ArticleCard } from "@/components/public/ArticleCard";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() || "";

  const articles = query
    ? await prisma.article.findMany({
        where: {
          ...PUBLIC_ARTICLE_WHERE,
          OR: [
            { title: { contains: query } },
            { excerpt: { contains: query } },
            { content: { contains: query } },
          ],
        },
        orderBy: { publishedAt: "desc" },
        take: 30,
        include: { category: { select: { name: true, slug: true } } },
      })
    : [];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 space-y-5">
        <h1 className="text-2xl font-bold text-slate-900">
          {query ? `"${query}" के लिए खोज परिणाम (${articles.length})` : "खबरें खोजें"}
        </h1>

        {articles.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            {query ? "कोई समाचार नहीं मिला। कृपया दूसरे शब्दों से खोजें।" : "ऊपर सर्च बॉक्स में कोई विषय लिखें।"}
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((art) => (
              <ArticleCard key={art.id} article={art} variant="horizontal" />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
