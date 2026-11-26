import Link from "next/link";
import { Radio } from "lucide-react";

export interface TickerLine {
  id: string;
  text: string;
  url: string;
}

export function Ticker({ items }: { items: TickerLine[] }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800 overflow-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center h-9">
        <span className="inline-flex items-center gap-1.5 bg-red-700 text-white text-xs font-bold px-2.5 py-1 rounded-sm mr-3 flex-shrink-0 uppercase tracking-wide">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          ब्रेकिंग न्यूज़
        </span>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-ticker gap-8 text-xs sm:text-sm whitespace-nowrap">
            {[...items, ...items].map((item, idx) => (
              <Link
                key={`${item.id}-${idx}`}
                href={item.url}
                className="hover:text-red-300 transition inline-flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                {item.text}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
