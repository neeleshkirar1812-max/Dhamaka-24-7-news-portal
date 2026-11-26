"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Upload } from "lucide-react";

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export default function AdminMediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/media");
    if (res.ok) {
      const data = await res.json();
      setMedia(data.media || []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Upload failed");
      } else {
        toast.success("Image uploaded");
        load();
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this media file?")) return;
    const res = await fetch(`/api/admin/media?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Deleted");
      setMedia((prev) => prev.filter((m) => m.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Media Library</h1>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold cursor-pointer">
          <Upload className="w-4 h-4" />
          {uploading ? "Uploading..." : "Upload Image"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {media.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          No uploaded media yet. Upload JPG, PNG, or WebP images (max 5 MB).
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {media.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <img src={m.url} alt={m.filename} className="w-full h-32 object-cover bg-slate-100" />
              <div className="p-2.5 text-xs space-y-2 flex-1 flex flex-col justify-between">
                <div className="truncate font-medium text-slate-700">{m.filename}</div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(m.url);
                      toast.success("URL copied");
                    }}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy URL
                  </button>
                  <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:text-red-800 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
