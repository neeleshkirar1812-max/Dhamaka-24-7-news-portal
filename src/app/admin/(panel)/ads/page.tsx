"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Download,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

interface KpiWindow {
  impressions: number;
  clicks: number;
  ctr: number;
  directRevenue: number;
  manualRevenue: number;
  totalRevenue: number;
}

interface AdsDashboardData {
  adsEnabled: boolean;
  adsTxt: string;
  cachedInsight: {
    summary: string;
    highlights: string[];
    recommendations: string[];
    generatedAt: string;
  } | null;
  kpis: { today: KpiWindow; days7: KpiWindow; days30: KpiWindow };
  chartSeries: { date: string; totalRevenue: number; directRevenue: number; manualRevenue: number }[];
  placements: { id: string; key: string; name: string; type: "ADSENSE" | "CUSTOM"; adCode: string | null; isActive: boolean }[];
  ads: { id: string; title: string; imageUrl: string; targetUrl: string; cpm: number; cpc: number; isActive: boolean; placement: { name: string } }[];
  revEntries: { id: string; date: string; source: string; amount: number; note: string | null }[];
  placementStats: { id: string; name: string; impressions: number; clicks: number; ctr: number; revenue: number }[];
  adStats: { id: string; title: string; placementName: string; impressions: number; clicks: number; ctr: number; revenue: number }[];
  topArticleReport: { id: string; title: string; views: number; hideAds: boolean; estimatedRevenue: number; category: { name: string } }[];
}

export default function AdminAdsPage() {
  const [data, setData] = useState<AdsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [adsTxtDraft, setAdsTxtDraft] = useState("");

  // New Direct Ad Form
  const [adTitle, setAdTitle] = useState("");
  const [adPlacementId, setAdPlacementId] = useState("");
  const [adImageUrl, setAdImageUrl] = useState("");
  const [adTargetUrl, setAdTargetUrl] = useState("");
  const [adCpm, setAdCpm] = useState("50");
  const [adCpc, setAdCpc] = useState("4");

  // Manual AdSense Entry
  const [revDate, setRevDate] = useState(new Date().toISOString().slice(0, 10));
  const [revAmount, setRevAmount] = useState("");
  const [revNote, setRevNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/ads");
    if (res.ok) {
      const json: AdsDashboardData = await res.json();
      setData(json);
      setAdsTxtDraft(json.adsTxt);
      if (!adPlacementId && json.placements[0]) {
        setAdPlacementId(json.placements[0].id);
      }
    }
    setLoading(false);
  }, [adPlacementId]);

  useEffect(() => {
    load();
  }, [load]);

  async function postAction(payload: Record<string, unknown>, msg: string) {
    const res = await fetch("/api/admin/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast.success(msg);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Action failed");
    }
  }

  async function generateInsights() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/admin/ai/revenue-insights", { method: "POST", body: "{}" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to generate insights");
      } else {
        toast.success("AI revenue insights updated");
        load();
      }
    } finally {
      setAiLoading(false);
    }
  }

  if (loading || !data) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading Ads &amp; Revenue Dashboard...</div>;
  }

  const windows = [
    { label: "Today", kpi: data.kpis.today },
    { label: "Last 7 Days", kpi: data.kpis.days7 },
    { label: "Last 30 Days", kpi: data.kpis.days30 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ads &amp; Revenue Dashboard</h1>
          <p className="text-xs text-slate-500">Manage AdSense, Direct Banner Ads, Impressions/Clicks, and ads.txt</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={data.adsEnabled}
              onChange={(e) =>
                postAction(
                  { action: "toggleGlobal", enabled: e.target.checked },
                  e.target.checked ? "Global ads enabled" : "Global ads disabled"
                )
              }
            />
            Enable Ads Globally
          </label>
          <a
            href="/api/admin/ads/export"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {windows.map((w) => (
          <div key={w.label} className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase">{w.label}</div>
            <div className="text-2xl font-extrabold text-slate-900">₹{w.kpi.totalRevenue.toFixed(2)}</div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div>
                <div className="text-slate-400">Impressions</div>
                <div className="font-semibold text-slate-800">{w.kpi.impressions.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-slate-400">Clicks</div>
                <div className="font-semibold text-slate-800">{w.kpi.clicks.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-slate-400">CTR</div>
                <div className="font-semibold text-emerald-700">{w.kpi.ctr}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Line Chart + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">30-Day Revenue Trend (INR)</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.chartSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="totalRevenue" name="Total (₹)" stroke="#b91c1c" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="directRevenue" name="Direct Ads (₹)" stroke="#0f766e" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-purple-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-purple-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-700" />
              AI Revenue Insights
            </h2>
            <button
              onClick={generateInsights}
              disabled={aiLoading}
              className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {aiLoading ? "Analyzing..." : "Generate"}
            </button>
          </div>
          {data.cachedInsight ? (
            <div className="text-xs space-y-2.5 text-slate-700">
              <p className="font-medium text-slate-900">{data.cachedInsight.summary}</p>
              <div>
                <div className="font-semibold text-purple-800 mb-1">Highlights:</div>
                <ul className="list-disc pl-4 space-y-1">
                  {data.cachedInsight.highlights.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-purple-800 mb-1">Recommendations:</div>
                <ul className="list-disc pl-4 space-y-1">
                  {data.cachedInsight.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Click Generate to summarize your 7/30-day ad performance and CTR trends using aggregated metrics.
            </p>
          )}
        </div>
      </div>

      {/* Direct Ad Creation & Manual AdSense Entry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            postAction(
              {
                action: "createAd",
                placementId: adPlacementId,
                title: adTitle,
                imageUrl: adImageUrl,
                targetUrl: adTargetUrl,
                cpm: Number(adCpm) || 0,
                cpc: Number(adCpc) || 0,
                isActive: true,
              },
              "Direct ad created"
            );
            setAdTitle("");
            setAdImageUrl("");
            setAdTargetUrl("");
          }}
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-3"
        >
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-red-700" />
            Add Direct / Custom Banner Ad
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <input
              required
              placeholder="Campaign / Ad Title"
              value={adTitle}
              onChange={(e) => setAdTitle(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <select
              value={adPlacementId}
              onChange={(e) => setAdPlacementId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              {data.placements.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              required
              placeholder="Banner Image URL"
              value={adImageUrl}
              onChange={(e) => setAdImageUrl(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              required
              type="url"
              placeholder="Click Target URL (https://...)"
              value={adTargetUrl}
              onChange={(e) => setAdTargetUrl(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              step="0.01"
              placeholder="CPM (INR)"
              value={adCpm}
              onChange={(e) => setAdCpm(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              step="0.01"
              placeholder="CPC (INR)"
              value={adCpc}
              onChange={(e) => setAdCpc(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer">
            Create Direct Ad
          </button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            postAction(
              {
                action: "createRevenueEntry",
                date: revDate,
                source: "ADSENSE",
                amount: Number(revAmount) || 0,
                note: revNote,
              },
              "AdSense earnings logged"
            );
            setRevAmount("");
            setRevNote("");
          }}
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-3"
        >
          <h2 className="text-sm font-bold text-slate-900">Log Daily AdSense Earnings (Manual Entry)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <input
              type="date"
              required
              value={revDate}
              onChange={(e) => setRevDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="number"
              step="0.01"
              required
              placeholder="Amount (₹)"
              value={revAmount}
              onChange={(e) => setRevAmount(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              placeholder="Note (optional)"
              value={revNote}
              onChange={(e) => setRevNote(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold cursor-pointer">
            Add Earnings Entry
          </button>
        </form>
      </div>

      {/* Placement Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Ad Placements (AdSense vs Custom)</h2>
        <div className="divide-y divide-slate-100">
          {data.placements.map((p) => (
            <PlacementRow key={p.id} placement={p} onSave={(payload) => postAction(payload, "Placement updated")} />
          ))}
        </div>
      </div>

      {/* Performance Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 overflow-x-auto">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Revenue by Placement (30d)</h2>
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2">Placement</th>
                <th className="p-2">Impr.</th>
                <th className="p-2">Clicks</th>
                <th className="p-2">CTR</th>
                <th className="p-2">Rev (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.placementStats.map((ps) => (
                <tr key={ps.id}>
                  <td className="p-2 font-medium">{ps.name}</td>
                  <td className="p-2">{ps.impressions}</td>
                  <td className="p-2">{ps.clicks}</td>
                  <td className="p-2">{ps.ctr}%</td>
                  <td className="p-2 font-semibold">₹{ps.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 overflow-x-auto">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Top Articles by Views &amp; Est. Revenue</h2>
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2">Article</th>
                <th className="p-2">Views</th>
                <th className="p-2">Est. Rev (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.topArticleReport.map((ar) => (
                <tr key={ar.id}>
                  <td className="p-2 line-clamp-1 max-w-xs">{ar.title}</td>
                  <td className="p-2">{ar.views.toLocaleString()}</td>
                  <td className="p-2 font-semibold">
                    {ar.hideAds ? "Ads Hidden" : `₹${ar.estimatedRevenue.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Direct Ads List & ads.txt */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Active &amp; Scheduled Direct Ads</h2>
          <div className="divide-y divide-slate-100 text-xs">
            {data.ads.map((ad) => (
              <div key={ad.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{ad.title}</div>
                  <div className="text-slate-500">
                    {ad.placement.name} · CPM ₹{ad.cpm} · CPC ₹{ad.cpc}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await fetch("/api/admin/ads", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: ad.id, isActive: !ad.isActive }),
                      });
                      load();
                    }}
                    className={`px-2 py-1 rounded font-medium cursor-pointer ${
                      ad.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {ad.isActive ? "Active" : "Paused"}
                  </button>
                  <button
                    onClick={async () => {
                      await fetch(`/api/admin/ads?id=${ad.id}`, { method: "DELETE" });
                      load();
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">ads.txt Editor (served at /ads.txt)</h2>
            <button
              onClick={() => postAction({ action: "saveAdsTxt", content: adsTxtDraft }, "ads.txt saved")}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
            >
              Save ads.txt
            </button>
          </div>
          <textarea
            rows={5}
            value={adsTxtDraft}
            onChange={(e) => setAdsTxtDraft(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg font-mono text-xs"
          />
        </div>
      </div>
    </div>
  );
}

function PlacementRow({
  placement,
  onSave,
}: {
  placement: AdsDashboardData["placements"][number];
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [type, setType] = useState<"ADSENSE" | "CUSTOM">(placement.type);
  const [adCode, setAdCode] = useState(placement.adCode ?? "");
  const [isActive, setIsActive] = useState(placement.isActive);

  return (
    <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="min-w-[200px]">
        <div className="font-semibold text-slate-900">{placement.name}</div>
        <div className="text-slate-400">{placement.key}</div>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "ADSENSE" | "CUSTOM")}
          className="px-2.5 py-1.5 border border-slate-300 rounded bg-white"
        >
          <option value="CUSTOM">Custom / Direct</option>
          <option value="ADSENSE">AdSense / Script</option>
        </select>
        {type === "ADSENSE" && (
          <input
            value={adCode}
            onChange={(e) => setAdCode(e.target.value)}
            placeholder="Paste AdSense HTML/script snippet..."
            className="flex-1 min-w-[200px] px-2.5 py-1.5 border border-slate-300 rounded"
          />
        )}
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
        <button
          type="button"
          onClick={() => onSave({ action: "updatePlacement", id: placement.id, type, adCode, isActive })}
          className="px-3 py-1.5 rounded bg-slate-900 text-white font-medium cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
}
