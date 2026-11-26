"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";

interface TrashArticle {
  id: string;
  title: string;
  deletedAt: string;
  category: { name: string };
}

export default function TrashArticlesPage() {
  const [articles, setArticles] = useState<TrashArticle[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/articles?trash=true");
    if (res.ok) {
      const data = await res.json();
      setArticles(data.articles || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function restore(id: string) {
    const res = await fetch(`/api/admin/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    if (res.ok) {
      toast.success("Article restored");
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } else {
      toast.error("Failed to restore");
    }
  }

  async function deletePermanent(id: string) {
    if (!window.confirm("Permanently delete this article? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/articles/${id}?permanent=true`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Permanently deleted");
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } else {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Trash</h1>
        <Link href="/admin/articles" className="text-sm text-red-700 font-medium hover:underline">
          ← Back to Articles
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading trash...</div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Trash is empty.</div>
        ) : (
          articles.map((art) => (
            <div key={art.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-sm text-slate-900">{art.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {art.category.name} · Deleted {new Date(art.deletedAt).toLocaleString("en-IN")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => restore(art.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
                <button
                  onClick={() => deletePermanent(art.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Permanently
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
