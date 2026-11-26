import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  const base = env.siteUrl.replace(/\/$/, "");
  const content = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/admin/

Sitemap: ${base}/sitemap.xml
Sitemap: ${base}/news-sitemap.xml
`;

  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
