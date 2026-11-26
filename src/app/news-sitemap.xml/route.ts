import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { PUBLIC_ARTICLE_WHERE } from "@/lib/news-queries";

export const dynamic = "force-dynamic";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const base = env.siteUrl.replace(/\/$/, "");
  const since48h = new Date(Date.now() - 48 * 3600 * 1000);

  const articles = await prisma.article.findMany({
    where: {
      ...PUBLIC_ARTICLE_WHERE,
      publishedAt: { gte: since48h },
    },
    orderBy: { publishedAt: "desc" },
    take: 500,
    select: { title: true, slug: true, publishedAt: true },
  });

  const items = articles.map(
    (a) => `  <url>
    <loc>${base}/news/${a.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>Dhamaka 24*7</news:name>
        <news:language>hi</news:language>
      </news:publication>
      <news:publication_date>${(a.publishedAt ?? new Date()).toISOString()}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items.join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
