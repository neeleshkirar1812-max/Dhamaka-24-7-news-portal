import { Sparkles } from "lucide-react";

/**
 * Displays the pre-generated 30-second article summary.
 * Hidden automatically when aiSummary is empty.
 */
export function AiSummaryBox({ summary }: { summary?: string | null }) {
  if (!summary || !summary.trim()) return null;

  const lines = summary
    .split("\n")
    .map((l) => l.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  return (
    <div className="my-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-600" />
          30-सेकंड सारांश (Quick Summary)
        </h2>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
          AI-generated summary
        </span>
      </div>
      <ul className="space-y-1.5 text-sm text-slate-800 list-disc pl-5">
        {lines.map((line, i) => (
          <li key={i} className="leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
