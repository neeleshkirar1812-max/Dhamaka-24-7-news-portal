import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { PUBLIC_ARTICLE_WHERE } from "@/lib/news-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = env.siteUrl.replace(/\/$/, "");
  const [categories, articles] = await Promise.all([
    prisma.category.findMany({ select: { slug: true } }),
    prisma.article.findMany({
      where: PUBLIC_ARTICLE_WHERE,
      orderBy: { publishedAt: "desc" },
      take: 1000,
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const urls = [
    `<url><loc>${base}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    ...categories.map(
      (c) => `<url><loc>${base}/category/${c.slug}</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`
    ),
    ...articles.map(
      (a) =>
        `<url><loc>${base}/news/${a.slug}</loc><lastmod>${a.updatedAt.toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
