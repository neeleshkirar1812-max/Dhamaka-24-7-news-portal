"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ArticleCard, type ArticleCardItem } from "./ArticleCard";

export function LoadMoreFeed({
  initialArticles,
  totalCount,
  categorySlug,
  betweenAdNode,
}: {
  initialArticles: ArticleCardItem[];
  totalCount: number;
  categorySlug?: string;
  betweenAdNode?: React.ReactNode;
}) {
  const [articles, setArticles] = useState<ArticleCardItem[]>(initialArticles);
  const [loading, setLoading] = useState(false);

  const hasMore = articles.length < totalCount;

  async function loadMore() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(articles.length),
        limit: "10",
      });
      if (categorySlug) params.set("category", categorySlug);

      const res = await fetch(`/api/public/articles?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setArticles((prev) => [...prev, ...(data.articles || [])]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {articles.map((art, index) => (
        <div key={art.id} className="space-y-3">
          <ArticleCard article={art} variant="horizontal" />
          {betweenAdNode && (index + 1) % 5 === 0 && (
            <div className="py-2">{betweenAdNode}</div>
          )}
        </div>
      ))}

      {hasMore && (
        <div className="pt-3 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={loadMore}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-700 hover:bg-red-800 text-white text-sm font-semibold transition disabled:opacity-60 cursor-pointer"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "लोड हो रहा है..." : "और खबरें देखें (Load More)"}
          </button>
        </div>
      )}
    </div>
  );
}
