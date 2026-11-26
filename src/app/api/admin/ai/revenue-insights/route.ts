import { aiGenerateRevenueInsights } from "@/lib/ai";
import { handleAiRoute } from "@/lib/ai/http";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  return handleAiRoute(req, async () => {
    const since30 = new Date();
    since30.setHours(0, 0, 0, 0);
    since30.setDate(since30.getDate() - 29);

    const [stats, revEntries, topCategories] = await Promise.all([
      prisma.adStat.findMany({
        where: { date: { gte: since30 } },
        include: {
          ad: { select: { cpm: true, cpc: true } },
          placement: { select: { key: true, name: true } },
        },
      }),
      prisma.revenueEntry.findMany({ where: { date: { gte: since30 } } }),
      prisma.article.groupBy({
        by: ["categoryId"],
        where: { status: "PUBLISHED", deletedAt: null },
        _sum: { views: true },
        orderBy: { _sum: { views: "desc" } },
        take: 5,
      }),
    ]);

    const byPlacement: Record<string, { impressions: number; clicks: number; revenue: number }> = {};
    for (const s of stats) {
      const k = s.placement.key;
      if (!byPlacement[k]) byPlacement[k] = { impressions: 0, clicks: 0, revenue: 0 };
      byPlacement[k].impressions += s.impressions;
      byPlacement[k].clicks += s.clicks;
      if (s.ad) {
        byPlacement[k].revenue += (s.impressions / 1000) * s.ad.cpm + s.clicks * s.ad.cpc;
      }
    }

    const adsenseTotal = revEntries.reduce((acc, r) => acc + r.amount, 0);
    const categories = await prisma.category.findMany({
      where: { id: { in: topCategories.map((c) => c.categoryId) } },
      select: { id: true, name: true },
    });
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    const aggregated = {
      windowDays: 30,
      adsenseManualTotalInr: Number(adsenseTotal.toFixed(2)),
      placements: byPlacement,
      topCategoriesByViews: topCategories.map((c) => ({
        category: catMap[c.categoryId] ?? c.categoryId,
        views: c._sum.views ?? 0,
      })),
    };

    const insight = await aiGenerateRevenueInsights(aggregated);
    const payload = {
      ...insight,
      generatedAt: new Date().toISOString(),
    };

    await prisma.setting.upsert({
      where: { key: "aiRevenueInsight" },
      update: { value: JSON.stringify(payload) },
      create: { key: "aiRevenueInsight", value: JSON.stringify(payload) },
    });

    return { insight: payload };
  });
}
