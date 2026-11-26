import Link from "next/link";

export interface NavCategory {
  id: string;
  name: string;
  slug: string;
}

export function CategoryNav({
  categories,
  cities,
  activeSlug,
}: {
  categories: NavCategory[];
  cities: NavCategory[];
  activeSlug?: string;
}) {
  return (
    <div className="bg-white border-b border-slate-200 shadow-xs">
      {/* Main Nav */}
      <nav className="bg-red-700 text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center gap-1 overflow-x-auto no-scrollbar h-11 text-sm font-semibold">
          <Link
            href="/"
            className={`px-3 py-2 whitespace-nowrap rounded-sm transition ${
              !activeSlug ? "bg-red-900" : "hover:bg-red-800"
            }`}
          >
            होम
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className={`px-3 py-2 whitespace-nowrap rounded-sm transition ${
                activeSlug === cat.slug ? "bg-red-900" : "hover:bg-red-800"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </nav>

      {/* MP City Sub-Nav */}
      {cities.length > 0 && (
        <div className="bg-slate-100 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center gap-2 overflow-x-auto py-1.5 text-xs">
            <span className="font-bold text-red-700 whitespace-nowrap">MP शहर:</span>
            {cities.map((city) => (
              <Link
                key={city.id}
                href={`/category/${city.slug}`}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition ${
                  activeSlug === city.slug
                    ? "bg-red-700 text-white font-semibold"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-red-400 hover:text-red-700"
                }`}
              >
                {city.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
