"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Save, Sparkles } from "lucide-react";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    siteName: "धमाका 24*7",
    siteTagline: "",
    socialFacebook: "",
    socialTwitter: "",
    socialYoutube: "",
    defaultMetaTitle: "",
    defaultMetaDescription: "",
    adsenseClientId: "",
    aiEnabled: "true",
    aiDailyLimit: "200",
  });
  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    todayCalls: number;
    dailyLimit: number;
    provider: string;
    model: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Change Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.settings) setSettings((prev) => ({ ...prev, ...d.settings }));
        if (d?.aiStatus) setAiStatus(d.aiStatus);
      });
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPwd(true);
    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to change password");
      } else {
        toast.success("Password updated");
        setCurrentPassword("");
        setNewPassword("");
      }
    } finally {
      setChangingPwd(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Site &amp; AI Settings</h1>

      <form onSubmit={saveSettings} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">General &amp; SEO</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Site Name</label>
            <input
              value={settings.siteName}
              onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Site Tagline</label>
            <input
              value={settings.siteTagline}
              onChange={(e) => setSettings({ ...settings, siteTagline: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">AdSense Client ID</label>
            <input
              value={settings.adsenseClientId}
              onChange={(e) => setSettings({ ...settings, adsenseClientId: e.target.value })}
              placeholder="ca-pub-xxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default Meta Title</label>
            <input
              value={settings.defaultMetaTitle}
              onChange={(e) => setSettings({ ...settings, defaultMetaTitle: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2 pt-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-700" />
          AI Editorial Assistant Settings
        </h2>
        {aiStatus && (
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700">
            API Key:{" "}
            <strong>
              {aiStatus.configured
                ? `Configured (${aiStatus.provider})`
                : "Missing (set GEMINI_API_KEY or ANTHROPIC_API_KEY)"}
            </strong>{" "}
            · Model: <strong>{aiStatus.model}</strong> · Today&apos;s Calls:{" "}
            <strong>{aiStatus.todayCalls} / {aiStatus.dailyLimit}</strong>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.aiEnabled !== "false"}
              onChange={(e) => setSettings({ ...settings, aiEnabled: String(e.target.checked) })}
            />
            <span>Enable AI Editorial Assistant</span>
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Daily AI Call Limit</label>
            <input
              type="number"
              min={1}
              value={settings.aiDailyLimit}
              onChange={(e) => setSettings({ ...settings, aiDailyLimit: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>

      {/* Change Admin Password */}
      <form onSubmit={changePassword} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-red-700" />
          Change Admin Password
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <input
            type="password"
            required
            placeholder="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="New Password (min 8 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <button
          type="submit"
          disabled={changingPwd}
          className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold cursor-pointer"
        >
          {changingPwd ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
