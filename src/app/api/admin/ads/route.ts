import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function startOfDaysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const d30 = startOfDaysAgo(29);
  const d7 = startOfDaysAgo(6);
  const d0 = startOfDaysAgo(0);

  const [placements, ads, stats30, revEntries, settings, topArticles] = await Promise.all([
    prisma.adPlacement.findMany({ orderBy: { key: "asc" } }),
    prisma.ad.findMany({
      orderBy: { createdAt: "desc" },
      include: { placement: { select: { key: true, name: true } } },
    }),
    prisma.adStat.findMany({
      where: { date: { gte: d30 } },
      include: {
        ad: { select: { id: true, title: true, cpm: true, cpc: true } },
        placement: { select: { id: true, key: true, name: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.revenueEntry.findMany({
      where: { date: { gte: d30 } },
      orderBy: { date: "desc" },
    }),
    prisma.setting.findMany({
      where: { key: { in: ["adsEnabled", "adsTxt", "aiRevenueInsight"] } },
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      orderBy: { views: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        slug: true,
        views: true,
        hideAds: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const calcWindow = (since: Date) => {
    let impressions = 0;
    let clicks = 0;
    let directRevenue = 0;
    for (const st of stats30) {
      if (st.date >= since) {
        impressions += st.impressions;
        clicks += st.clicks;
        if (st.ad) {
          directRevenue += (st.impressions / 1000) * st.ad.cpm + st.clicks * st.ad.cpc;
        }
      }
    }
    let manualRevenue = 0;
    for (const r of revEntries) {
      if (r.date >= since) manualRevenue += r.amount;
    }
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    return {
      impressions,
      clicks,
      ctr: Number(ctr.toFixed(2)),
      directRevenue: Number(directRevenue.toFixed(2)),
      manualRevenue: Number(manualRevenue.toFixed(2)),
      totalRevenue: Number((directRevenue + manualRevenue).toFixed(2)),
    };
  };

  // Daily chart series
  const dailyMap = new Map<
    string,
    { date: string; impressions: number; clicks: number; directRevenue: number; manualRevenue: number; totalRevenue: number }
  >();
  for (let i = 29; i >= 0; i--) {
    const dt = startOfDaysAgo(i);
    const key = dt.toISOString().slice(0, 10);
    dailyMap.set(key, {
      date: key,
      impressions: 0,
      clicks: 0,
      directRevenue: 0,
      manualRevenue: 0,
      totalRevenue: 0,
    });
  }
  for (const st of stats30) {
    const key = st.date.toISOString().slice(0, 10);
    const row = dailyMap.get(key);
    if (row) {
      row.impressions += st.impressions;
      row.clicks += st.clicks;
      const rev = st.ad ? (st.impressions / 1000) * st.ad.cpm + st.clicks * st.ad.cpc : 0;
      row.directRevenue += rev;
      row.totalRevenue += rev;
    }
  }
  for (const r of revEntries) {
    const key = r.date.toISOString().slice(0, 10);
    const row = dailyMap.get(key);
    if (row) {
      row.manualRevenue += r.amount;
      row.totalRevenue += r.amount;
    }
  }

  const chartSeries = Array.from(dailyMap.values()).map((r) => ({
    ...r,
    directRevenue: Number(r.directRevenue.toFixed(2)),
    manualRevenue: Number(r.manualRevenue.toFixed(2)),
    totalRevenue: Number(r.totalRevenue.toFixed(2)),
  }));

  // Per-placement summary
  const placementStats = placements.map((p) => {
    const rows = stats30.filter((s) => s.placementId === p.id);
    const impressions = rows.reduce((acc, r) => acc + r.impressions, 0);
    const clicks = rows.reduce((acc, r) => acc + r.clicks, 0);
    const revenue = rows.reduce(
      (acc, r) => acc + (r.ad ? (r.impressions / 1000) * r.ad.cpm + r.clicks * r.ad.cpc : 0),
      0
    );
    return {
      id: p.id,
      key: p.key,
      name: p.name,
      impressions,
      clicks,
      ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
      revenue: Number(revenue.toFixed(2)),
    };
  });

  // Per-ad summary
  const adStats = ads.map((a) => {
    const rows = stats30.filter((s) => s.adId === a.id);
    const impressions = rows.reduce((acc, r) => acc + r.impressions, 0);
    const clicks = rows.reduce((acc, r) => acc + r.clicks, 0);
    const revenue = (impressions / 1000) * a.cpm + clicks * a.cpc;
    return {
      id: a.id,
      title: a.title,
      placementName: a.placement.name,
      impressions,
      clicks,
      ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
      revenue: Number(revenue.toFixed(2)),
    };
  });

  const avgRpm =
    calcWindow(d30).totalRevenue > 0
      ? calcWindow(d30).totalRevenue / Math.max(1, topArticles.reduce((a, b) => a + b.views, 0) / 1000)
      : 45;

  const topArticleReport = topArticles.map((a) => ({
    ...a,
    estimatedRevenue: a.hideAds ? 0 : Number(((a.views / 1000) * avgRpm).toFixed(2)),
  }));

  let cachedInsight = null;
  if (settingsMap.aiRevenueInsight) {
    try {
      cachedInsight = JSON.parse(settingsMap.aiRevenueInsight);
    } catch {}
  }

  return NextResponse.json({
    adsEnabled: settingsMap.adsEnabled !== "false",
    adsTxt: settingsMap.adsTxt ?? "",
    cachedInsight,
    kpis: {
      today: calcWindow(d0),
      days7: calcWindow(d7),
      days30: calcWindow(d30),
    },
    chartSeries,
    placements,
    ads,
    revEntries,
    placementStats,
    adStats,
    topArticleReport,
  });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "toggleGlobal") {
      const enabled = Boolean(body.enabled);
      await prisma.setting.upsert({
        where: { key: "adsEnabled" },
        update: { value: String(enabled) },
        create: { key: "adsEnabled", value: String(enabled) },
      });
      revalidatePath("/");
      return NextResponse.json({ ok: true });
    }

    if (action === "saveAdsTxt") {
      const content = z.string().max(20000).parse(body.content);
      await prisma.setting.upsert({
        where: { key: "adsTxt" },
        update: { value: content },
        create: { key: "adsTxt", value: content },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "updatePlacement") {
      const parsed = z
        .object({
          id: z.string().min(1),
          type: z.enum(["ADSENSE", "CUSTOM"]),
          adCode: z.string().nullable().optional(),
          isActive: z.boolean(),
        })
        .parse(body);

      await prisma.adPlacement.update({
        where: { id: parsed.id },
        data: {
          type: parsed.type,
          adCode: parsed.adCode ?? null,
          isActive: parsed.isActive,
        },
      });
      revalidatePath("/");
      return NextResponse.json({ ok: true });
    }

    if (action === "createAd") {
      const parsed = z
        .object({
          placementId: z.string().min(1),
          title: z.string().min(1).max(160),
          imageUrl: z.string().min(1).max(1000),
          targetUrl: z.string().url(),
          cpm: z.number().min(0).default(0),
          cpc: z.number().min(0).default(0),
          startDate: z.string().optional().nullable(),
          endDate: z.string().optional().nullable(),
          isActive: z.boolean().default(true),
        })
        .parse(body);

      const ad = await prisma.ad.create({
        data: {
          placementId: parsed.placementId,
          title: parsed.title,
          imageUrl: parsed.imageUrl,
          targetUrl: parsed.targetUrl,
          cpm: parsed.cpm,
          cpc: parsed.cpc,
          startDate: parsed.startDate ? new Date(parsed.startDate) : null,
          endDate: parsed.endDate ? new Date(parsed.endDate) : null,
          isActive: parsed.isActive,
        },
      });
      revalidatePath("/");
      return NextResponse.json({ ad }, { status: 201 });
    }

    if (action === "createRevenueEntry") {
      const parsed = z
        .object({
          date: z.string().min(1),
          source: z.string().default("ADSENSE"),
          amount: z.number().min(0),
          note: z.string().max(300).optional(),
        })
        .parse(body);

      const entry = await prisma.revenueEntry.create({
        data: {
          date: new Date(parsed.date),
          source: parsed.source,
          amount: parsed.amount,
          note: parsed.note || null,
        },
      });
      return NextResponse.json({ entry }, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, isActive } = z
    .object({ id: z.string().min(1), isActive: z.boolean() })
    .parse(await req.json());

  await prisma.ad.update({ where: { id }, data: { isActive } });
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const kind = searchParams.get("kind") || "ad";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (kind === "revenue") {
    await prisma.revenueEntry.delete({ where: { id } });
  } else {
    await prisma.ad.delete({ where: { id } });
    revalidatePath("/");
  }
  return NextResponse.json({ ok: true });
}
