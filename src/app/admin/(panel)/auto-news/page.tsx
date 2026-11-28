"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

interface AutoNewsConfig {
  enabled: boolean;
  autoPublish: boolean;
  minScore: number;
  maxPerRun: number;
  generateImage: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  hasCronSecret: boolean;
}

interface TopicRow {
  id: string;
  name: string;
  query: string;
  scope: "GLOBAL" | "NATIONAL" | "STATE" | "CITY";
  categoryId: string;
  rssUrl: string | null;
  isActive: boolean;
  priority: number;
  lastRunAt: string | null;
  category: { id: string; name: string; slug: string };
}

interface LogRow {
  id: string;
  articleId: string | null;
  headline: string;
  scope: string;
  cityOrRegion: string;
  verification: string;
  confidence: number;
  outcome: string;
  reason: string | null;
  sourcesJson: string | null;
  createdAt: string;
}

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface RunResultSummary {
  processed: number;
  published: number;
  drafts: number;
  rejected: number;
  duplicatesSkipped: number;
  skippedReason?: string;
  results: Array<{
    topicName: string;
    scope: string;
    headline: string;
    verification: string;
    confidence: number;
    outcome: string;
    articleId?: string;
    articleSlug?: string;
    reason?: string;
  }>;
}

const SCOPE_LABELS: Record<string, string> = {
  GLOBAL: "विदेश / Global",
  NATIONAL: "देश / National",
  STATE: "राज्य / State",
  CITY: "शहर / City",
};

export default function AdminAutoNewsPage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AutoNewsConfig>({
    enabled: true,
    autoPublish: true,
    minScore: 80,
    maxPerRun: 3,
    generateImage: true,
    intervalMinutes: 60,
    lastRunAt: null,
    hasCronSecret: false,
  });
  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    enabled: boolean;
    todayCalls: number;
    dailyLimit: number;
    provider: string;
    model: string;
  } | null>(null);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [stats, setStats] = useState({ publishedToday: 0, draftsToday: 0, rejectedToday: 0 });

  // Settings form state
  const [cronSecretInput, setCronSecretInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Add City / Region form state
  const [newName, setNewName] = useState("");
  const [newScope, setNewScope] = useState<"CITY" | "STATE" | "NATIONAL" | "GLOBAL">("CITY");
  const [newQuery, setNewQuery] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [autoCreateCat, setAutoCreateCat] = useState(true);
  const [newRssUrl, setNewRssUrl] = useState("");
  const [addingTopic, setAddingTopic] = useState(false);

  // Scan execution state
  const [runningTopicId, setRunningTopicId] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<RunResultSummary | null>(null);

  const applyDashboardData = useCallback((d: Record<string, unknown>) => {
    if (d.config) setConfig(d.config as AutoNewsConfig);
    if (d.aiStatus) setAiStatus(d.aiStatus as typeof aiStatus);
    if (d.topics) setTopics(d.topics as TopicRow[]);
    if (d.logs) setLogs(d.logs as LogRow[]);
    if (d.categories) setCategories(d.categories as CategoryItem[]);
    if (typeof d.siteUrl === "string") setSiteUrl(d.siteUrl);
    if (d.stats) setStats(d.stats as typeof stats);
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auto-news");
      if (res.ok) {
        applyDashboardData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/auto-news")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) applyDashboardData(d);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyDashboardData]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/auto-news", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            enabled: config.enabled,
            autoPublish: config.autoPublish,
            minScore: config.minScore,
            maxPerRun: config.maxPerRun,
            generateImage: config.generateImage,
            intervalMinutes: config.intervalMinutes,
            ...(cronSecretInput.trim() ? { cronSecret: cronSecretInput.trim() } : {}),
          },
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to save Auto-News settings");
      } else {
        toast.success("AI News Desk settings saved");
        if (d.config) setConfig(d.config);
        setCronSecretInput("");
      }
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleAddTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddingTopic(true);
    try {
      const res = await fetch("/api/admin/auto-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          scope: newScope,
          query: (newQuery || `${newName.trim()} latest news`).trim(),
          categoryId: newCategoryId || undefined,
          autoCreateCategory: newScope === "CITY" ? autoCreateCat : false,
          rssUrl: newRssUrl.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Failed to add tracker");
      } else {
        toast.success(`${d.topic.name} added to watchlist`);
        setNewName("");
        setNewQuery("");
        setNewRssUrl("");
        setNewCategoryId("");
        loadAll();
      }
    } finally {
      setAddingTopic(false);
    }
  }

  async function toggleTopicActive(topic: TopicRow) {
    const res = await fetch("/api/admin/auto-news", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: topic.id, isActive: !topic.isActive }),
    });
    if (res.ok) {
      toast.success(`${topic.name} ${!topic.isActive ? "enabled" : "paused"}`);
      loadAll();
    } else {
      toast.error("Update failed");
    }
  }

  async function deleteTopic(topic: TopicRow) {
    if (!window.confirm(`Remove "${topic.name}" from AI News Desk?`)) return;
    const res = await fetch(`/api/admin/auto-news?id=${encodeURIComponent(topic.id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Removed");
      loadAll();
    }
  }

  async function runScan(topicId?: string) {
    setRunningTopicId(topicId ?? "__ALL__");
    setLastSummary(null);
    try {
      const res = await fetch("/api/admin/auto-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(topicId ? { topicId, maxItems: 2 } : { maxItems: config.maxPerRun }),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Scan failed");
      } else {
        const s: RunResultSummary = d.summary;
        setLastSummary(s);
        toast.success(
          `Scan done: ${s.published} published, ${s.drafts} draft, ${s.rejected} rejected`
        );
        loadAll();
      }
    } finally {
      setRunningTopicId(null);
    }
  }

  const cronEndpoint = `${siteUrl || "https://your-domain.com"}/api/cron/auto-news`;

  function copyCronUrl() {
    navigator.clipboard.writeText(cronEndpoint);
    toast.success("Cron URL copied");
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-red-700" />
            AI News Desk &amp; Fact-Check Automation
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Global, National, State व आपके हर शहर की ताज़ा खबरें खोजें, multi-source तथ्य-जांच (Fact-Check) करें और सीधे Draft या Live में पब्लिश करें।
          </p>
        </div>

        <button
          type="button"
          onClick={() => runScan()}
          disabled={runningTopicId !== null || !aiStatus?.enabled}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-xs cursor-pointer transition"
        >
          {runningTopicId === "__ALL__" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning &amp; Fact-Checking...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Scan &amp; Fact-Check Now
            </>
          )}
        </button>
      </div>

      {/* Warning if AI key missing */}
      {aiStatus && !aiStatus.configured && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>
            AI Engine चलाने के लिए <strong>Settings</strong> में जाकर <strong>Google Gemini API Key</strong> (Free Tier) सेव करें।
          </span>
          <Link
            href="/admin/settings"
            className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800"
          >
            Open Settings
          </Link>
        </div>
      )}

      {/* Quick KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">AI Engine Status</div>
          <div className="mt-1 flex items-center gap-2 font-bold text-slate-900">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                config.enabled && aiStatus?.enabled ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {config.enabled ? "Active" : "Paused"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Model: {aiStatus?.model || "gemini-3.5-flash-lite"} · {aiStatus?.todayCalls ?? 0}/
            {aiStatus?.dailyLimit ?? 200} calls today
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Published Today (Verified)</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">
            {stats.publishedToday}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Threshold: ≥ {config.minScore}%
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Queued in Drafts</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{stats.draftsToday}</div>
          <div className="text-[11px] text-slate-500 mt-1">Needs manual review</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Rejected (Fake / Disputed)</div>
          <div className="text-2xl font-extrabold text-red-700 mt-1">{stats.rejectedToday}</div>
          <div className="text-[11px] text-slate-500 mt-1">Blocked before upload</div>
        </div>
      </div>

      {/* Latest Scan Output Banner */}
      {lastSummary && (
        <div className="bg-slate-900 text-slate-100 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Latest Scan Result — Processed: {lastSummary.processed}, Published:{" "}
              {lastSummary.published}, Drafts: {lastSummary.drafts}, Rejected:{" "}
              {lastSummary.rejected}, Duplicates Skipped: {lastSummary.duplicatesSkipped}
            </h2>
            {lastSummary.skippedReason && (
              <span className="text-xs text-amber-300">{lastSummary.skippedReason}</span>
            )}
          </div>
          {lastSummary.results.length > 0 && (
            <div className="space-y-2">
              {lastSummary.results.map((r, i) => (
                <div
                  key={i}
                  className="bg-slate-800/80 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-white">
                      [{r.topicName}] {r.headline}
                    </div>
                    {r.reason && <div className="text-slate-300">{r.reason}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-700 font-semibold">
                      {r.verification} ({r.confidence}%)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-red-700 text-white font-semibold">
                      {r.outcome}
                    </span>
                    {r.articleSlug && r.outcome === "PUBLISHED" && (
                      <Link
                        href={`/news/${r.articleSlug}`}
                        target="_blank"
                        className="underline text-emerald-300"
                      >
                        Live View
                      </Link>
                    )}
                    {r.articleId && (
                      <Link
                        href={`/admin/articles/${r.articleId}`}
                        className="underline text-sky-300"
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Automation Settings */}
      <form
        onSubmit={saveSettings}
        className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Automation Rules &amp; Fact-Check Guard
          </h2>
          {config.lastRunAt && (
            <span className="text-xs text-slate-500">
              Last Auto-Scan: {new Date(config.lastRunAt).toLocaleString("en-IN")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
            <div>
              <div className="font-semibold text-slate-800">Enable Auto News Engine</div>
              <div className="text-[11px] text-slate-500">ऑटोमैटिक खबर स्कैनिंग चालू/बंद करें</div>
            </div>
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoPublish}
              onChange={(e) => setConfig({ ...config, autoPublish: e.target.checked })}
            />
            <div>
              <div className="font-semibold text-slate-800">Auto-Publish Verified News</div>
              <div className="text-[11px] text-slate-500">
                ON: Verified सीधे Live · OFF: सब Draft में
              </div>
            </div>
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={config.generateImage}
              onChange={(e) => setConfig({ ...config, generateImage: e.target.checked })}
            />
            <div>
              <div className="font-semibold text-slate-800">AI Editorial Photo</div>
              <div className="text-[11px] text-slate-500">
                Copyright-free फोटो बना कर Cloudinary में सेव करें
              </div>
            </div>
          </label>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Minimum Fact-Check Score (50-98%)
            </label>
            <input
              type="number"
              min={50}
              max={98}
              value={config.minScore}
              onChange={(e) => setConfig({ ...config, minScore: Number(e.target.value) || 80 })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Max Articles Per Scan (1-8)
            </label>
            <input
              type="number"
              min={1}
              max={8}
              value={config.maxPerRun}
              onChange={(e) => setConfig({ ...config, maxPerRun: Number(e.target.value) || 3 })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Auto-Scan Interval
            </label>
            <select
              value={config.intervalMinutes}
              onChange={(e) =>
                setConfig({ ...config, intervalMinutes: Number(e.target.value) || 60 })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value={30}>Every 30 Minutes</option>
              <option value={60}>Every 1 Hour (Recommended)</option>
              <option value={120}>Every 2 Hours</option>
              <option value={240}>Every 4 Hours</option>
              <option value={720}>Every 12 Hours</option>
            </select>
          </div>
        </div>

        {/* External Cron Info */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-2">
          <div className="font-semibold text-slate-800">
            24x7 Auto-Run Setup (Render Free Plan के लिए Cron Endpoint)
          </div>
          <p className="text-slate-600">
            वेबसाइट पर ट्रैफिक आने पर Auto-News अपने-आप चलता है। बिल्कुल तय समय पर चलाने के लिए किसी free scheduler (जैसे cron-job.org) पर यह URL और Secret लगाएँ:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-[11px] font-mono text-slate-800 break-all">
              {cronEndpoint}
            </code>
            <button
              type="button"
              onClick={copyCronUrl}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 text-white rounded text-[11px] cursor-pointer"
            >
              <Copy className="w-3 h-3" /> Copy URL
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="password"
              value={cronSecretInput}
              onChange={(e) => setCronSecretInput(e.target.value)}
              placeholder={
                config.hasCronSecret
                  ? "Cron Secret Configured (enter new value to rotate)"
                  : "Set Cron Secret (pass as ?secret=... or Bearer token)"
              }
              className="flex-1 min-w-[240px] px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
            />
            <button
              type="submit"
              disabled={savingSettings}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </form>

      {/* City & Region Watchlist ("कौन से शहर में क्या हो रहा है") */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-700" />
              City, State, Nation &amp; Global Watchlist (कौन से शहर में क्या हो रहा है)
            </h2>
            <p className="text-xs text-slate-500">
              यहाँ से किसी भी शहर या क्षेत्र को चालू/बंद करें, नया शहर जोड़ें, या 1 क्लिक में सिर्फ़ उस शहर की ताज़ा खबरें जांचें।
            </p>
          </div>
          <button
            type="button"
            onClick={loadAll}
            className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Add New City / Region Form */}
        <form onSubmit={handleAddTopic} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">City / Region Name</label>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. सीहोर or दिल्ली"
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Scope</label>
            <select
              value={newScope}
              onChange={(e) =>
                setNewScope(e.target.value as "CITY" | "STATE" | "NATIONAL" | "GLOBAL")
              }
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-sm"
            >
              <option value="CITY">City (शहर)</option>
              <option value="STATE">State (राज्य)</option>
              <option value="NATIONAL">National (देश)</option>
              <option value="GLOBAL">Global (विदेश)</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Search Keywords</label>
            <input
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              placeholder="Sehore MP latest news"
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Publish Category</label>
            <select
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-sm"
            >
              <option value="">Auto Match / Create City</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Custom RSS (Optional)</label>
            <input
              value={newRssUrl}
              onChange={(e) => setNewRssUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            {newScope === "CITY" && !newCategoryId && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCreateCat}
                  onChange={(e) => setAutoCreateCat(e.target.checked)}
                />
                Create MP City Menu Tab
              </label>
            )}
            <button
              type="submit"
              disabled={addingTopic}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-lg cursor-pointer text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              {addingTopic ? "Adding..." : "Add Watcher"}
            </button>
          </div>
        </form>

        {/* Topics Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="py-2.5 px-3">City / Region</th>
                <th className="py-2.5 px-3">Scope</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Last Scanned</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && topics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Loading city watchlist...
                  </td>
                </tr>
              ) : (
                topics.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{t.query}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                        {t.scope === "GLOBAL" ? (
                          <Globe className="w-3 h-3" />
                        ) : (
                          <MapPin className="w-3 h-3" />
                        )}
                        {SCOPE_LABELS[t.scope] ?? t.scope}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-700">{t.category?.name}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">
                      {t.lastRunAt ? new Date(t.lastRunAt).toLocaleString("en-IN") : "Never"}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => toggleTopicActive(t)}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer ${
                          t.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {t.isActive ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => runScan(t.id)}
                        disabled={runningTopicId !== null || !aiStatus?.enabled}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs rounded cursor-pointer"
                      >
                        {runningTopicId === t.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        Scan Now
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTopic(t)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer align-middle"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fact-Check Verification Log */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          Fact-Check Audit Log (ताज़ा जांच इतिहास)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="py-2.5 px-3">Region</th>
                <th className="py-2.5 px-3">Headline &amp; Fact Note</th>
                <th className="py-2.5 px-3">Verification</th>
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    अभी तक कोई Auto-News scan नहीं चला है। ऊपर &ldquo;Scan &amp; Fact-Check Now&rdquo; दबाएँ।
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  let sources: Array<{ publisher?: string; url?: string }> = [];
                  try {
                    if (log.sourcesJson) sources = JSON.parse(log.sourcesJson);
                  } catch {
                    sources = [];
                  }
                  return (
                    <tr key={log.id} className="align-top hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{log.cityOrRegion}</div>
                        <div className="text-[11px] text-slate-500">{log.scope}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">{log.headline}</div>
                        {log.reason && (
                          <div className="text-xs text-slate-600 mt-0.5">{log.reason}</div>
                        )}
                        {sources.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {sources.slice(0, 3).map((s, idx) =>
                              s.url && /^https?:\/\//i.test(s.url) ? (
                                <a
                                  key={idx}
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 text-[11px] text-red-700 hover:underline"
                                >
                                  {s.publisher || "Source"}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : null
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                            log.verification === "VERIFIED"
                              ? "bg-emerald-100 text-emerald-800"
                              : log.verification === "DISPUTED"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {log.verification === "VERIFIED" ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : (
                            <ShieldAlert className="w-3 h-3" />
                          )}
                          {log.verification} ({log.confidence}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                        <div className="font-semibold text-slate-800">{log.outcome}</div>
                        {log.articleId && (
                          <Link
                            href={`/admin/articles/${log.articleId}`}
                            className="text-sky-700 hover:underline"
                          >
                            Edit Article
                          </Link>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
