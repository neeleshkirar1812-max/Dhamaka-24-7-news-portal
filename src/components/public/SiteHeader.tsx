import Link from "next/link";
import { Search } from "lucide-react";
import { getNavData } from "@/lib/news-queries";
import { CategoryNav } from "./CategoryNav";
import { Ticker } from "./Ticker";
import { AdSlot } from "./AdSlot";

export async function SiteHeader({ activeSlug }: { activeSlug?: string }) {
  const { topCategories, mpCities, tickerLines, siteName, siteTagline } =
    await getNavData();

  const todayFormatted = new Date().toLocaleDateString("hi-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <>
      <header className="bg-white">
        {/* Top Utility Bar */}
        <div className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 h-8 flex items-center justify-between gap-3">
            <span suppressHydrationWarning className="truncate">
              {todayFormatted}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-700 hidden sm:inline">
                हिंदी | English
              </span>
              <Link href="/rss.xml" className="hover:text-red-700 hidden sm:inline">
                RSS
              </Link>
              <Link href="/admin/login" className="hover:text-red-700">
                Admin
              </Link>
            </div>
          </div>
        </div>

        {/* Masthead */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="px-2.5 h-10 rounded-lg bg-red-700 text-white flex items-center justify-center font-black text-sm tracking-tight shadow-xs">
              24*7
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-red-700 tracking-tight leading-none">
                {siteName}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                {siteTagline}
              </div>
            </div>
          </Link>

          {/* Search Bar */}
          <form action="/search" method="GET" className="relative w-full sm:w-72">
            <input
              type="search"
              name="q"
              placeholder="खबरें खोजें (Search)..."
              className="w-full pl-3.5 pr-9 py-1.5 text-sm border border-slate-300 rounded-full bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-2.5 top-2 text-slate-500 hover:text-red-700 cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Header Leaderboard Ad Strip */}
        <div className="hidden lg:flex justify-center pb-2.5 px-4">
          <AdSlot placement="header-leaderboard" />
        </div>
      </header>

      {/* Sticky Navigation + Breaking Ticker */}
      <div className="sticky top-0 z-40 shadow-sm">
        <CategoryNav categories={topCategories} cities={mpCities} activeSlug={activeSlug} />
        <Ticker items={tickerLines} />
      </div>
    </>
  );
}
