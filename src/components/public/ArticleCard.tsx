import Link from "next/link";
import { formatTimeAgo } from "@/lib/news-queries";

export interface ArticleCardItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  imageAlt?: string | null;
  publishedAt?: Date | string | null;
  createdAt: Date | string;
  category: { name: string; slug: string };
}

export function ArticleCard({
  article,
  variant = "horizontal",
}: {
  article: ArticleCardItem;
  variant?: "horizontal" | "vertical" | "compact";
}) {
  const timeText = formatTimeAgo(article.publishedAt ?? article.createdAt);

  if (variant === "compact") {
    return (
      <Link
        href={`/news/${article.slug}`}
        className="group flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-b-0"
      >
        {article.featuredImage && (
          <img
            src={article.featuredImage}
            alt={article.imageAlt || article.title}
            loading="lazy"
            className="w-20 h-14 object-cover rounded flex-shrink-0 bg-slate-100"
          />
        )}
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 group-hover:text-red-700 line-clamp-2 leading-snug">
            {article.title}
          </h4>
          <span suppressHydrationWarning className="text-[11px] text-slate-500 mt-1 block">
            {article.category.name} · {timeText}
          </span>
        </div>
      </Link>
    );
  }

  if (variant === "vertical") {
    return (
      <Link
        href={`/news/${article.slug}`}
        className="group bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition flex flex-col"
      >
        <div className="aspect-video bg-slate-100 overflow-hidden">
          {article.featuredImage && (
            <img
              src={article.featuredImage}
              alt={article.imageAlt || article.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          )}
        </div>
        <div className="p-3.5 flex-1 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-red-700 uppercase">
              {article.category.name}
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-red-700 mt-1 line-clamp-2 leading-snug">
              {article.title}
            </h3>
          </div>
          <span suppressHydrationWarning className="text-[11px] text-slate-500 mt-2">{timeText}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/news/${article.slug}`}
      className="group bg-white rounded-lg border border-slate-200 p-3 sm:p-4 hover:shadow-md transition flex gap-3 sm:gap-4"
    >
      {article.featuredImage && (
        <div className="w-28 sm:w-44 aspect-video sm:aspect-[16/10] bg-slate-100 rounded overflow-hidden flex-shrink-0">
          <img
            src={article.featuredImage}
            alt={article.imageAlt || article.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        </div>
      )}
      <div className="min-w-0 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-red-700">{article.category.name}</span>
            <span className="text-slate-400">·</span>
            <span suppressHydrationWarning className="text-slate-500">{timeText}</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-red-700 mt-1 line-clamp-2 leading-snug">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 line-clamp-2 hidden sm:block">
              {article.excerpt}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
