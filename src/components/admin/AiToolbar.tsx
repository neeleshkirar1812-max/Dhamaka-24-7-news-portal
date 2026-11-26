"use client";

import { useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

type RewriteAction =
  | "rewrite"
  | "shorten"
  | "expand"
  | "fix_grammar"
  | "tone_formal"
  | "tone_neutral"
  | "tone_simple";

const ACTIONS: { id: RewriteAction; label: string }[] = [
  { id: "rewrite", label: "Rewrite" },
  { id: "shorten", label: "Shorten" },
  { id: "expand", label: "Expand" },
  { id: "fix_grammar", label: "Fix Grammar" },
  { id: "tone_formal", label: "Tone: Formal" },
  { id: "tone_neutral", label: "Tone: Neutral" },
  { id: "tone_simple", label: "Tone: Simple" },
];

export function AiToolbar({
  selectedText,
  aiAvailable,
  aiDisabledReason,
  onAccept,
}: {
  selectedText: string;
  aiAvailable: boolean;
  aiDisabledReason?: string;
  onAccept: (newText: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<RewriteAction | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function runAction(action: RewriteAction) {
    if (!selectedText.trim()) {
      toast.info("Select some text in the editor first.");
      return;
    }
    setActiveAction(action);
    setLoading(true);
    setPreview(null);

    try {
      const res = await fetch("/api/admin/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, action, language: "auto" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "AI rewrite failed");
        setActiveAction(null);
      } else {
        setPreview(data.rewrittenText);
      }
    } catch {
      toast.error("Network error calling AI");
      setActiveAction(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-purple-50/60 px-3 py-1.5">
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-800 mr-1">
        <Sparkles className="w-3.5 h-3.5" />
        AI Assist:
      </span>
      {ACTIONS.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={!aiAvailable || loading}
          title={!aiAvailable ? aiDisabledReason || "AI is unavailable" : `AI ${a.label} on selected text`}
          onClick={() => runAction(a.id)}
          className="px-2 py-0.5 text-xs rounded border border-purple-200 bg-white text-purple-800 hover:bg-purple-100 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {loading && activeAction === a.id ? "..." : a.label}
        </button>
      ))}

      {(loading || preview !== null) && (
        <div className="mt-2 w-full rounded-lg border border-purple-300 bg-white p-3 shadow-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-purple-800">
              AI Preview ({ACTIONS.find((x) => x.id === activeAction)?.label})
            </span>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setActiveAction(null);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-purple-700" />
              Generating suggestion...
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-800 whitespace-pre-wrap bg-slate-50 p-2.5 rounded border border-slate-100">
                {preview}
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (preview) onAccept(preview);
                    setPreview(null);
                    setActiveAction(null);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => activeAction && runAction(activeAction)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setActiveAction(null);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium cursor-pointer"
                >
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
