import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAiStatus } from "@/lib/ai";
import { FileText, Eye, IndianRupee, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalArticles,
    publishedCount,
    draftCount,
    unpublishedCount,
    todayViewsAgg,
    todayManualRev,
    aiStatus,
    recentArticles,
  ] = await Promise.all([
    prisma.article.count({ where: { deletedAt: null } }),
    prisma.article.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    prisma.article.count({ where: { status: "DRAFT", deletedAt: null } }),
    prisma.article.count({ where: { status: "UNPUBLISHED", deletedAt: null } }),
    prisma.articleView.aggregate({
      where: { date: { gte: startOfDay } },
      _sum: { count: true },
    }),
    prisma.revenueEntry.aggregate({
      where: { date: { gte: startOfDay } },
      _sum: { amount: true },
    }),
    getAiStatus(),
    prisma.article.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { category: true },
    }),
  ]);

  const cards = [
    {
      label: "Articles (Pub / Draft / Unpub)",
      value: `${totalArticles}`,
      sub: `${publishedCount} published · ${draftCount} drafts · ${unpublishedCount} unpublished`,
      icon: FileText,
    },
    {
      label: "Today's Views",
      value: `${todayViewsAgg._sum.count ?? 0}`,
      sub: "Tracked article views today",
      icon: Eye,
    },
    {
      label: "Today's Manual Revenue",
      value: `₹${(todayManualRev._sum.amount ?? 0).toFixed(2)}`,
      sub: "See Ads & Revenue for CPM/CPC + AdSense",
      icon: IndianRupee,
    },
    {
      label: "AI Usage Today",
      value: `${aiStatus.todayCalls} / ${aiStatus.dailyLimit}`,
      sub: aiStatus.enabled
        ? `${aiStatus.todayInputTokens + aiStatus.todayOutputTokens} tokens · ${aiStatus.model}`
        : "AI disabled or API key missing",
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Editorial Dashboard</h1>
        <Link
          href="/admin/articles/new"
          className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold rounded-lg"
        >
          Write New Story
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
                <span>{c.label}</span>
                <Icon className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{c.value}</div>
              <div className="text-xs text-slate-500 mt-1">{c.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Recently Updated Articles</h2>
          <Link href="/admin/articles" className="text-xs text-red-700 font-medium hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {recentArticles.map((art) => (
            <div key={art.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Link
                  href={`/admin/articles/${art.id}`}
                  className="font-medium text-sm text-slate-900 hover:text-red-700 truncate block"
                >
                  {art.title}
                </Link>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>{art.category.name}</span>
                  <span>·</span>
                  <span>{art.views} views</span>
                  {art.aiAssisted && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">
                      AI-assisted
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  art.status === "PUBLISHED"
                    ? "bg-emerald-50 text-emerald-700"
                    : art.status === "DRAFT"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {art.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
