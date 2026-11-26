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
  const articles = await prisma.article.findMany({
    where: PUBLIC_ARTICLE_WHERE,
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: { category: true },
  });

  const items = articles.map(
    (a) => `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${base}/news/${a.slug}</link>
      <guid>${base}/news/${a.slug}</guid>
      <category>${escapeXml(a.category.name)}</category>
      <pubDate>${(a.publishedAt ?? a.createdAt).toUTCString()}</pubDate>
      <description>${escapeXml(a.excerpt || a.subtitle || "")}</description>
    </item>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>धमाका 24*7</title>
    <link>${base}</link>
    <description>मध्य प्रदेश, देश और दुनिया की ताजा खबरें</description>
    <language>hi</language>
${items.join("\n")}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
