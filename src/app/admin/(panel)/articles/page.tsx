"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckSquare,
  Edit,
  ExternalLink,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  featuredImage: string | null;
  status: string;
  authorName: string;
  views: number;
  aiAssisted: boolean;
  publishedAt: string | null;
  createdAt: string;
  category: { id: string; name: string; slug: string };
}

interface CategoryItem {
  id: string;
  name: string;
}

export default function AdminArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  // Filters
  const [status, setStatus] = useState("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // AI Draft from Notes Modal
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesLang, setNotesLang] = useState<"hi" | "en">("hi");
  const [notesCat, setNotesCat] = useState("");
  const [drafting, setDrafting] = useState(false);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (categoryId !== "ALL") params.set("categoryId", categoryId);
    if (search.trim()) params.set("search", search.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const res = await fetch(`/api/admin/articles?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setArticles(data.articles || []);
    }
    setLoading(false);
  }, [status, categoryId, search, from, to]);

  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.categories) {
          setCategories(d.categories);
          if (d.categories[0]) setNotesCat(d.categories[0].id);
        }
      });
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  async function updateRowStatus(id: string, nextStatus: "PUBLISHED" | "UNPUBLISHED") {
    const prev = articles;
    setArticles((list) => list.map((a) => (a.id === id ? { ...a, status: nextStatus } : a)));
    const res = await fetch(`/api/admin/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      setArticles(prev);
      toast.error("Failed to update status");
    } else {
      toast.success(nextStatus === "PUBLISHED" ? "Article published" : "Article unpublished");
    }
  }

  async function softDelete(id: string) {
    if (!window.confirm("Move this article to Trash?")) return;
    const prev = articles;
    setArticles((list) => list.filter((a) => a.id !== id));
    const res = await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setArticles(prev);
      toast.error("Failed to delete article");
    } else {
      toast.success("Moved to Trash");
    }
  }

  async function runBulk(action: "publish" | "unpublish" | "delete") {
    if (selected.length === 0) return;
    if (action === "delete" && !window.confirm(`Move ${selected.length} articles to Trash?`)) return;

    const res = await fetch("/api/admin/articles/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, action }),
    });
    if (res.ok) {
      toast.success(`Bulk ${action} completed`);
      setSelected([]);
      loadArticles();
    } else {
      toast.error("Bulk action failed");
    }
  }

  async function handleDraftFromNotes(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim() || !notesCat) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/admin/ai/draft-from-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, language: notesLang, categoryId: notesCat }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate draft");
      } else {
        toast.success("AI draft created! Please review [VERIFY] markers before publishing.");
        setNotesOpen(false);
        router.push(`/admin/articles/${data.article.id}`);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDrafting(false);
    }
  }

  const allSelected = articles.length > 0 && selected.length === articles.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Articles</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            AI Draft from Notes
          </button>
          <Link
            href="/admin/articles/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            New Article
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="ALL">All Status</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="UNPUBLISHED">Unpublished</option>
        </select>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
        />
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="bg-slate-900 text-white rounded-lg px-4 py-2.5 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-2 font-medium">
            <CheckSquare className="w-4 h-4 text-red-400" />
            {selected.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runBulk("publish")}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
            >
              Publish
            </button>
            <button
              onClick={() => runBulk("unpublish")}
              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 cursor-pointer"
            >
              Unpublish
            </button>
            <button
              onClick={() => runBulk("delete")}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase">
            <tr>
              <th className="p-3 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) =>
                    setSelected(e.target.checked ? articles.map((a) => a.id) : [])
                  }
                />
              </th>
              <th className="p-3">Article</th>
              <th className="p-3">Category</th>
              <th className="p-3">Status</th>
              <th className="p-3">Author</th>
              <th className="p-3">Views</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Loading articles...
                </td>
              </tr>
            ) : articles.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  No articles found.
                </td>
              </tr>
            ) : (
              articles.map((art) => (
                <tr key={art.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(art.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, art.id] : prev.filter((x) => x !== art.id)
                        )
                      }
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {art.featuredImage ? (
                        <img
                          src={art.featuredImage}
                          alt=""
                          className="w-12 h-9 object-cover rounded border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-9 rounded bg-slate-100 flex-shrink-0" />
                      )}
                      <div className="min-w-0 max-w-sm">
                        <Link
                          href={`/admin/articles/${art.id}`}
                          className="font-medium text-slate-900 hover:text-red-700 line-clamp-1"
                        >
                          {art.title}
                        </Link>
                        {art.aiAssisted && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-50 text-purple-700">
                            AI-assisted
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-xs text-slate-600">{art.category.name}</td>
                  <td className="p-3">
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
                  </td>
                  <td className="p-3 text-xs text-slate-600">{art.authorName}</td>
                  <td className="p-3 text-xs text-slate-700 font-medium">{art.views}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {new Date(art.publishedAt || art.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/admin/articles/${art.id}`}
                        className="p-1.5 rounded hover:bg-slate-200 text-slate-700"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Link>
                      {art.status !== "PUBLISHED" ? (
                        <button
                          onClick={() => updateRowStatus(art.id, "PUBLISHED")}
                          className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 cursor-pointer"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          onClick={() => updateRowStatus(art.id, "UNPUBLISHED")}
                          className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 cursor-pointer"
                        >
                          Unpublish
                        </button>
                      )}
                      {art.status === "PUBLISHED" && (
                        <Link
                          href={`/news/${art.slug}`}
                          target="_blank"
                          className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                          title="View live"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <button
                        onClick={() => softDelete(art.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                        title="Move to Trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* AI Draft from Notes Modal */}
      {notesOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-700" />
                AI Draft from Press Notes
              </h2>
              <button onClick={() => setNotesOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Always saved as a DRAFT with AI-assisted badge. Unknown details will be marked [VERIFY].
            </p>
            <form onSubmit={handleDraftFromNotes} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={notesLang}
                  onChange={(e) => setNotesLang(e.target.value as "hi" | "en")}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="hi">Hindi (Devanagari)</option>
                  <option value="en">English</option>
                </select>
                <select
                  value={notesCat}
                  onChange={(e) => setNotesCat(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                required
                rows={7}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste bullet points, press release notes, facts, dates..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNotesOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={drafting}
                  className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
                >
                  {drafting ? "Generating Draft..." : "Create AI Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
