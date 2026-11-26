import { prisma } from "@/lib/prisma";

export const PUBLIC_ARTICLE_WHERE = {
  status: "PUBLISHED",
  deletedAt: null,
} as const;

export async function getNavData() {
  const [categories, tickerItems, breakingArticles, settings] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        children: {
          orderBy: [{ order: "asc" }, { name: "asc" }],
        },
      },
    }),
    prisma.tickerItem.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      take: 10,
    }),
    prisma.article.findMany({
      where: { ...PUBLIC_ARTICLE_WHERE, isBreaking: true },
      orderBy: { publishedAt: "desc" },
      take: 6,
      select: { id: true, title: true, slug: true },
    }),
    prisma.setting.findMany({
      where: { key: { in: ["siteName", "siteTagline", "adsEnabled"] } },
    }),
  ]);

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const topCategories = categories.filter((c) => !c.parentId);
  const mpCategory = topCategories.find((c) => c.slug === "madhya-pradesh");
  const mpCities = mpCategory?.children ?? [];

  const tickerLines = [
    ...tickerItems.map((t) => ({ id: t.id, text: t.text, url: t.url || "#" })),
    ...breakingArticles.map((a) => ({
      id: `art-${a.id}`,
      text: a.title,
      url: `/news/${a.slug}`,
    })),
  ];

  return {
    topCategories,
    mpCities,
    tickerLines,
    siteName: settingsMap.siteName || "धमाका 24*7",
    siteTagline: settingsMap.siteTagline || "मध्य प्रदेश, देश और दुनिया की ताजा खबरें",
    adsEnabled: settingsMap.adsEnabled !== "false",
  };
}

export function formatTimeAgo(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return "अभी";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} मिनट पहले`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} घंटे पहले`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} दिन पहले`;
  return date.toLocaleDateString("hi-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Splits sanitized article HTML after paragraphs so in-article AdSlots can be
 * injected cleanly after paragraph 2 and paragraph 5.
 */
export function splitHtmlAtParagraphs(html: string): {
  part1: string;
  part2: string;
  part3: string;
} {
  const parts = html.split(/(<\/p>)/i);
  let pCount = 0;
  let split1 = -1;
  let split2 = -1;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].toLowerCase() === "</p>") {
      pCount++;
      if (pCount === 2) split1 = i + 1;
      if (pCount === 5) split2 = i + 1;
    }
  }

  if (split1 === -1) {
    return { part1: html, part2: "", part3: "" };
  }
  if (split2 === -1) {
    return {
      part1: parts.slice(0, split1).join(""),
      part2: parts.slice(split1).join(""),
      part3: "",
    };
  }
  return {
    part1: parts.slice(0, split1).join(""),
    part2: parts.slice(split1, split2).join(""),
    part3: parts.slice(split2).join(""),
  };
}
