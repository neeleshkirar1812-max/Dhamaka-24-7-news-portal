import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PUBLIC_ARTICLE_WHERE } from "@/lib/news-queries";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { ArticleCard } from "@/components/public/ArticleCard";
import { LoadMoreFeed } from "@/components/public/LoadMoreFeed";
import { AdSlot } from "@/components/public/AdSlot";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = await prisma.category.findUnique({ where: { slug } });
  if (!cat) return {};
  return {
    title: `${cat.name} समाचार (News)`,
    description: `${cat.name} की ताजा और बड़ी खबरें, विश्लेषण और विशेष रिपोर्ट।`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: { children: { orderBy: { order: "asc" } } },
  });

  if (!category) {
    notFound();
  }

  const categoryIds = [category.id, ...category.children.map((c) => c.id)];

  const [articles, totalCount, trending] = await Promise.all([
    prisma.article.findMany({
      where: { ...PUBLIC_ARTICLE_WHERE, categoryId: { in: categoryIds } },
      orderBy: { publishedAt: "desc" },
      take: 10,
      include: { category: { select: { name: true, slug: true } } },
    }),
    prisma.article.count({
      where: { ...PUBLIC_ARTICLE_WHERE, categoryId: { in: categoryIds } },
    }),
    prisma.article.findMany({
      where: PUBLIC_ARTICLE_WHERE,
      orderBy: { views: "desc" },
      take: 6,
      include: { category: { select: { name: true, slug: true } } },
    }),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader activeSlug={slug} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-6 space-y-6">
        <div className="border-b-2 border-red-700 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-red-700">होम</Link> / {category.name}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {category.name} समाचार
            </h1>
          </div>

          {category.children.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/category/${child.slug}`}
                  className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-medium hover:border-red-500 hover:text-red-700"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            {articles.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                इस श्रेणी में अभी कोई समाचार प्रकाशित नहीं है।
              </div>
            ) : (
              <LoadMoreFeed
                initialArticles={articles}
                totalCount={totalCount}
                categorySlug={slug}
                betweenAdNode={<AdSlot placement="list-between" />}
              />
            )}
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-2.5">
              <AdSlot placement="sidebar-top" />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b-2 border-red-700 pb-2 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-700" />
                सबसे ज्यादा पढ़ी गईं
              </h3>
              {trending.map((art) => (
                <ArticleCard key={art.id} article={art} variant="compact" />
              ))}
            </div>
            <div className="sticky top-32 bg-white rounded-xl border border-slate-200 p-2.5">
              <AdSlot placement="sidebar-sticky" />
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
