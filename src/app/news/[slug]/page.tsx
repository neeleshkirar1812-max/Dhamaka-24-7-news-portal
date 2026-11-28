import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, User, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { PUBLIC_ARTICLE_WHERE, splitHtmlAtParagraphs } from "@/lib/news-queries";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";
import { AiSummaryBox } from "@/components/public/AiSummaryBox";
import { ShareButtons } from "@/components/public/ShareButtons";
import { ViewTracker } from "@/components/public/ViewTracker";
import { ArticleCard } from "@/components/public/ArticleCard";
import { AdSlot } from "@/components/public/AdSlot";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.article.findFirst({
    where: { slug, ...PUBLIC_ARTICLE_WHERE },
  });

  if (!article) return {};

  const title = article.metaTitle || article.title;
  const description = article.metaDescription || article.excerpt || article.subtitle || "";
  const url = `${env.siteUrl}/news/${article.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: article.canonicalUrl || url,
    },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      images: article.featuredImage ? [{ url: article.featuredImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: article.featuredImage ? [article.featuredImage] : undefined,
    },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const article = await prisma.article.findFirst({
    where: { slug, ...PUBLIC_ARTICLE_WHERE },
    include: {
      category: true,
      tags: { include: { tag: true } },
    },
  });

  if (!article) {
    notFound();
  }

  const [related, trending] = await Promise.all([
    prisma.article.findMany({
      where: {
        ...PUBLIC_ARTICLE_WHERE,
        categoryId: article.categoryId,
        id: { not: article.id },
      },
      orderBy: { publishedAt: "desc" },
      take: 4,
      include: { category: { select: { name: true, slug: true } } },
    }),
    prisma.article.findMany({
      where: PUBLIC_ARTICLE_WHERE,
      orderBy: { views: "desc" },
      take: 5,
      include: { category: { select: { name: true, slug: true } } },
    }),
  ]);

  const cleanHtml = sanitizeArticleHtml(article.content);
  const { part1, part2, part3 } = splitHtmlAtParagraphs(cleanHtml);
  const canonicalUrl = `${env.siteUrl}/news/${article.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.metaDescription || article.excerpt || "",
    image: article.featuredImage ? [article.featuredImage] : [],
    datePublished: (article.publishedAt ?? article.createdAt).toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: {
      "@type": "Person",
      name: article.authorName,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader activeSlug={article.category.slug} />
      <ViewTracker articleId={article.id} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Article Content */}
          <article className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 sm:p-8 shadow-xs">
            <div className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
              <Link href="/" className="hover:text-red-700">होम</Link>
              <span>/</span>
              <Link href={`/category/${article.category.slug}`} className="text-red-700 font-semibold hover:underline">
                {article.category.name}
              </Link>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
              {article.title}
            </h1>

            {article.subtitle && (
              <p className="text-base sm:text-lg text-slate-600 mt-3 font-medium">
                {article.subtitle}
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <User className="w-3.5 h-3.5 text-red-700" />
                  {article.authorName}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  प्रकाशित:{" "}
                  {new Date(article.publishedAt ?? article.createdAt).toLocaleString("hi-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <ShareButtons title={article.title} url={canonicalUrl} />
            </div>

            {article.featuredImage && (
              <figure className="mt-5">
                <img
                  src={article.featuredImage}
                  alt={article.imageAlt || article.title}
                  className="w-full max-h-[460px] object-cover rounded-xl border border-slate-200"
                />
                {article.imageCaption && (
                  <figcaption className="text-xs text-slate-500 mt-2 italic">
                    {article.imageCaption}
                  </figcaption>
                )}
              </figure>
            )}

            {/* 30-second AI Summary Box */}
            <AiSummaryBox summary={article.aiSummary} />

            {/* Article Body with In-Article Ad Slots after para 2 and para 5 */}
            <div className="mt-6 article-prose">
              <div dangerouslySetInnerHTML={{ __html: part1 }} />
              {!article.hideAds && part2 && (
                <div className="my-5">
                  <AdSlot placement="in-article-2" hide={article.hideAds} />
                </div>
              )}
              {part2 && <div dangerouslySetInnerHTML={{ __html: part2 }} />}
              {!article.hideAds && part3 && (
                <div className="my-5">
                  <AdSlot placement="in-article-5" hide={article.hideAds} />
                </div>
              )}
              {part3 && <div dangerouslySetInnerHTML={{ __html: part3 }} />}
            </div>

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className="mt-8 pt-5 border-t border-slate-200 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600">टैग्स:</span>
                {article.tags.map(({ tag }) => (
                  <Link
                    key={tag.id}
                    href={`/search?q=${encodeURIComponent(tag.name)}`}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-red-50 hover:text-red-700 text-xs font-medium text-slate-700 transition"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            {!article.hideAds && (
              <div className="bg-white rounded-xl border border-slate-200 p-2.5">
                <AdSlot placement="sidebar-top" hide={article.hideAds} />
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-base font-extrabold text-slate-900 border-b-2 border-red-700 pb-2 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-700" />
                सबसे ज्यादा पढ़ी गईं
              </h3>
              {trending.map((art) => (
                <ArticleCard key={art.id} article={art} variant="compact" />
              ))}
            </div>

            {!article.hideAds && (
              <div className="sticky top-32 bg-white rounded-xl border border-slate-200 p-2.5">
                <AdSlot placement="sidebar-sticky" hide={article.hideAds} />
              </div>
            )}
          </aside>
        </div>

        {/* Related / More from this category */}
        {related.length > 0 && (
          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-extrabold text-slate-900 border-b-2 border-red-700 pb-2">
              {article.category.name} की अन्य खबरें
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((rel) => (
                <ArticleCard key={rel.id} article={rel} variant="vertical" />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
