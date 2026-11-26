import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stats = await prisma.adStat.findMany({
    orderBy: { date: "desc" },
    include: {
      ad: { select: { title: true, cpm: true, cpc: true } },
      placement: { select: { key: true, name: true } },
    },
  });

  const rows = [
    ["Date", "Placement", "Ad Title", "Impressions", "Clicks", "CTR (%)", "Estimated Revenue (INR)"].join(","),
    ...stats.map((s) => {
      const ctr = s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : "0.00";
      const rev = s.ad
        ? ((s.impressions / 1000) * s.ad.cpm + s.clicks * s.ad.cpc).toFixed(2)
        : "0.00";
      return [
        s.date.toISOString().slice(0, 10),
        `"${s.placement.name}"`,
        `"${s.ad?.title ?? "AdSense / Placement"}"`,
        s.impressions,
        s.clicks,
        ctr,
        rev,
      ].join(",");
    }),
  ];

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ad-revenue-report.csv"`,
    },
  });
}
