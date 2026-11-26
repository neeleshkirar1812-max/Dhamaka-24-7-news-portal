"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  order: number;
  parent: { id: string; name: string } | null;
  _count: { articles: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
  const [order, setOrder] = useState("0");

  async function load() {
    const res = await fetch("/api/admin/categories");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories || []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: slug || undefined,
        parentId: parentId || null,
        order: Number(order) || 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to create category");
    } else {
      toast.success("Category created");
      setName("");
      setSlug("");
      setParentId("");
      load();
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this category?")) return;
    const res = await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Cannot delete");
    } else {
      toast.success("Category deleted");
      load();
    }
  }

  const parents = categories.filter((c) => !c.parentId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Categories &amp; MP Cities</h1>

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. दमोह or Auto"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Slug (optional)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="damoh"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Parent Category</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="">None (Top-level)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Order</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Parent</th>
              <th className="p-3">Order</th>
              <th className="p-3">Articles</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-900">
                  {c.parentId ? `↳ ${c.name}` : c.name}
                </td>
                <td className="p-3 text-xs text-slate-500">{c.slug}</td>
                <td className="p-3 text-xs text-slate-600">{c.parent?.name ?? "—"}</td>
                <td className="p-3 text-xs">{c.order}</td>
                <td className="p-3 text-xs font-medium">{c._count.articles}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
