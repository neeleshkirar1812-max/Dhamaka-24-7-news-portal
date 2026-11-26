"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface TickerRow {
  id: string;
  text: string;
  url: string | null;
  isActive: boolean;
  order: number;
}

export default function AdminTickerPage() {
  const [items, setItems] = useState<TickerRow[]>([]);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  async function load() {
    const res = await fetch("/api/admin/ticker");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/ticker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, url: url || null }),
    });
    if (res.ok) {
      toast.success("Ticker item added");
      setText("");
      setUrl("");
      load();
    } else {
      toast.error("Failed to add ticker item");
    }
  }

  async function toggleActive(item: TickerRow) {
    await fetch("/api/admin/ticker", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/ticker?id=${id}`, { method: "DELETE" });
    toast.success("Removed");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Breaking News Ticker Manager</h1>
        <p className="text-xs text-slate-500">
          Active ticker items appear alongside articles marked as Breaking News.
        </p>
      </div>

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          required
          maxLength={140}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Breaking ticker headline (<= 90 chars recommended)..."
          className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/news/slug (optional)"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium text-sm text-slate-900">{item.text}</div>
              {item.url && <div className="text-xs text-slate-500">{item.url}</div>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(item)}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                  item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.isActive ? "Active" : "Paused"}
              </button>
              <button onClick={() => remove(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
