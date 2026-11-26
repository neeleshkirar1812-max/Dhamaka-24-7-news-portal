"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface TagRow {
  id: string;
  name: string;
  slug: string;
  _count: { articles: number };
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const res = await fetch("/api/admin/tags");
    if (res.ok) {
      const data = await res.json();
      setTags(data.tags || []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      toast.success("Tag saved");
      setName("");
      load();
    } else {
      toast.error("Failed to create tag");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/tags?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Tag deleted");
      setTags((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Tags</h1>

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-3">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag name..."
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 max-w-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Tag
        </button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap gap-2">
        {tags.map((t) => (
          <div
            key={t.id}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-sm text-slate-800"
          >
            <span>#{t.name}</span>
            <span className="text-xs text-slate-500">({t._count.articles})</span>
            <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
