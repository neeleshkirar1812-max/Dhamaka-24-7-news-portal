import Link from "next/link";
import { Flame, TrendingUp, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { publishScheduledArticles } from "@/lib/scheduler";
import { PUBLIC_ARTICLE_WHERE, formatTimeAgo } from "@/lib/news-queries";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { ArticleCard } from "@/components/public/ArticleCard";
import { LoadMoreFeed } from "@/components/public/LoadMoreFeed";
import { AdSlot } from "@/components/public/AdSlot";

export const revalidate = 60;

export default async function HomePage() {
  await publishScheduledArticles().catch(() => {});

  const [featuredRaw, latestArticles, totalCount, trendingArticles, cityCategories] =
    await Promise.all([
      prisma.article.findMany({
        where: { ...PUBLIC_ARTICLE_WHERE, isFeatured: true },
        orderBy: { publishedAt: "desc" },
        take: 5,
        include: { category: { select: { name: true, slug: true } } },
      }),
      prisma.article.findMany({
        where: PUBLIC_ARTICLE_WHERE,
        orderBy: { publishedAt: "desc" },
        take: 10,
        include: { category: { select: { name: true, slug: true } } },
      }),
      prisma.article.count({ where: PUBLIC_ARTICLE_WHERE }),
      prisma.article.findMany({
        where: PUBLIC_ARTICLE_WHERE,
        orderBy: [{ views: "desc" }, { publishedAt: "desc" }],
        take: 6,
        include: { category: { select: { name: true, slug: true } } },
      }),
      prisma.category.findMany({
        where: { slug: { in: ["bhopal", "indore", "gwalior", "jabalpur", "ujjain"] } },
        orderBy: { order: "asc" },
        include: {
          articles: {
            where: PUBLIC_ARTICLE_WHERE,
            orderBy: { publishedAt: "desc" },
            take: 4,
            include: { category: { select: { name: true, slug: true } } },
          },
        },
      }),
    ]);

  const heroPool = featuredRaw.length >= 5 ? featuredRaw : latestArticles.slice(0, 5);
  const leadStory = heroPool[0];
  const sideStories = heroPool.slice(1, 5);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-6 space-y-8">
        {/* Hero Section: 1 Lead + 4 Side Stories */}
        {leadStory && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <Link
              href={`/news/${leadStory.slug}`}
              className="lg:col-span-7 group relative rounded-xl overflow-hidden bg-slate-900 min-h-[300px] sm:min-h-[380px] flex items-end shadow-md"
            >
              {leadStory.featuredImage && (
                <img
                  src={leadStory.featuredImage}
                  alt={leadStory.imageAlt || leadStory.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition duration-500"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="relative p-5 sm:p-7 text-white">
                <span className="inline-block px-2.5 py-0.5 rounded bg-red-700 text-xs font-bold mb-2">
                  {leadStory.category.name}
                </span>
                <h1 className="text-xl sm:text-3xl font-extrabold leading-snug group-hover:text-red-200 transition">
                  {leadStory.title}
                </h1>
                {leadStory.excerpt && (
                  <p className="text-xs sm:text-sm text-slate-200 mt-2 line-clamp-2">
                    {leadStory.excerpt}
                  </p>
                )}
              </div>
            </Link>

            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {sideStories.map((story) => (
                <Link
                  key={story.id}
                  href={`/news/${story.slug}`}
                  className="group bg-white rounded-lg border border-slate-200 p-3 flex gap-3 hover:shadow-md transition"
                >
                  {story.featuredImage && (
                    <img
                      src={story.featuredImage}
                      alt={story.imageAlt || story.title}
                      className="w-24 h-20 object-cover rounded flex-shrink-0 bg-slate-100"
                    />
                  )}
                  <div className="min-w-0 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-red-700">
                      {story.category.name}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 group-hover:text-red-700 line-clamp-2 leading-snug">
                      {story.title}
                    </h2>
                    <span className="text-[11px] text-slate-500">
                      {formatTimeAgo(story.publishedAt ?? story.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Main Content + Sidebar */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Latest News Feed */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-red-700 pb-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-700" />
                ताजा खबरें (Latest News)
              </h2>
            </div>

            <LoadMoreFeed
              initialArticles={latestArticles}
              totalCount={totalCount}
              betweenAdNode={<AdSlot placement="list-between" />}
            />
          </div>

          {/* Trending & Ads Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <AdSlot placement="sidebar-top" />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b-2 border-red-700 pb-2 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-700" />
                सबसे ज्यादा पढ़ी गईं (Most Read)
              </h3>
              <div>
                {trendingArticles.map((art) => (
                  <ArticleCard key={art.id} article={art} variant="compact" />
                ))}
              </div>
            </div>

            <div className="sticky top-32 bg-white rounded-xl border border-slate-200 p-4">
              <AdSlot placement="sidebar-sticky" />
            </div>
          </aside>
        </section>

        {/* City-wise MP Blocks */}
        <section className="space-y-6">
          <div className="border-b-2 border-red-700 pb-2 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-red-700" />
              मध्य प्रदेश शहर विशेष (City News)
            </h2>
            <Link href="/category/madhya-pradesh" className="text-xs font-bold text-red-700 hover:underline">
              सभी शहर देखें →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cityCategories
              .filter((c) => c.articles.length > 0)
              .map((city) => (
                <div
                  key={city.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-extrabold text-base text-red-700">{city.name}</h3>
                    <Link
                      href={`/category/${city.slug}`}
                      className="text-xs text-slate-500 hover:text-red-700 font-medium"
                    >
                      और देखें →
                    </Link>
                  </div>
                  <div>
                    {city.articles.map((art) => (
                      <ArticleCard key={art.id} article={art} variant="compact" />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
