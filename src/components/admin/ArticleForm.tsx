"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Eye,
  Languages,
  Loader2,
  Radio,
  Save,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import { slugify } from "@/lib/slugify";
import { TiptapEditor } from "./TiptapEditor";

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface ArticleFormData {
  id?: string;
  title: string;
  slug: string;
  subtitle: string;
  excerpt: string;
  content: string;
  featuredImage: string;
  imageCaption: string;
  imageAlt: string;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  isBreaking: boolean;
  isFeatured: boolean;
  hideAds: boolean;
  authorName: string;
  categoryId: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  aiSummary: string;
  aiAssisted: boolean;
  scheduledAt: string;
  tagsText: string;
}

export function ArticleForm({
  initialData,
  categories,
}: {
  initialData?: Partial<ArticleFormData>;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const isEditing = Boolean(initialData?.id);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [headlineChoices, setHeadlineChoices] = useState<string[]>([]);
  const [tickerPreview, setTickerPreview] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<{
    enabled: boolean;
    limitReached: boolean;
    configured: boolean;
  }>({ enabled: false, limitReached: false, configured: false });

  const { register, handleSubmit, watch, setValue, getValues } = useForm<ArticleFormData>({
    defaultValues: {
      title: initialData?.title ?? "",
      slug: initialData?.slug ?? "",
      subtitle: initialData?.subtitle ?? "",
      excerpt: initialData?.excerpt ?? "",
      content: initialData?.content ?? "<p></p>",
      featuredImage: initialData?.featuredImage ?? "",
      imageCaption: initialData?.imageCaption ?? "",
      imageAlt: initialData?.imageAlt ?? "",
      status: initialData?.status ?? "DRAFT",
      isBreaking: initialData?.isBreaking ?? false,
      isFeatured: initialData?.isFeatured ?? false,
      hideAds: initialData?.hideAds ?? false,
      authorName: initialData?.authorName ?? "धमाका 24*7 संवाददाता",
      categoryId: initialData?.categoryId ?? categories[0]?.id ?? "",
      metaTitle: initialData?.metaTitle ?? "",
      metaDescription: initialData?.metaDescription ?? "",
      canonicalUrl: initialData?.canonicalUrl ?? "",
      aiSummary: initialData?.aiSummary ?? "",
      aiAssisted: initialData?.aiAssisted ?? false,
      scheduledAt: initialData?.scheduledAt ?? "",
      tagsText: initialData?.tagsText ?? "",
    },
  });

  const contentVal = watch("content");
  const titleVal = watch("title");
  const featuredImageVal = watch("featuredImage");
  const aiAssistedVal = watch("aiAssisted");

  useEffect(() => {
    fetch("/api/admin/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setAiStatus(d);
      })
      .catch(() => {});
  }, []);

  const aiAvailable = aiStatus.configured && aiStatus.enabled && !aiStatus.limitReached;
  const aiDisabledReason = !aiStatus.configured
    ? "Set GEMINI_API_KEY (free tier) or ANTHROPIC_API_KEY"
    : !aiStatus.enabled
    ? "AI is disabled in Site Settings"
    : aiStatus.limitReached
    ? "Daily AI limit reached"
    : undefined;

  const saveArticle = useCallback(
    async (values: ArticleFormData, overrideStatus?: "DRAFT" | "PUBLISHED" | "UNPUBLISHED", silent = false) => {
      setSaving(true);
      try {
        const payload = {
          ...values,
          status: overrideStatus ?? values.status,
          scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : null,
          tags: values.tagsText
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        };

        const url = isEditing
          ? `/api/admin/articles/${initialData!.id}`
          : "/api/admin/articles";
        const method = isEditing ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          if (!silent) toast.error(data.error || "Failed to save article");
          return null;
        }

        if (overrideStatus) {
          setValue("status", overrideStatus);
        }
        if (!silent) {
          toast.success(
            overrideStatus === "PUBLISHED"
              ? "Article published!"
              : overrideStatus === "UNPUBLISHED"
              ? "Article unpublished"
              : "Article saved"
          );
        }

        if (!isEditing && data.article?.id) {
          router.replace(`/admin/articles/${data.article.id}`);
        } else {
          router.refresh();
        }
        return data.article;
      } catch {
        if (!silent) toast.error("Network error saving article");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [initialData, isEditing, router, setValue]
  );

  // Autosave every 30 seconds when editing an existing article
  useEffect(() => {
    if (!isEditing) return;
    const timer = setInterval(() => {
      const vals = getValues();
      if (vals.title.trim() && vals.content.trim()) {
        saveArticle(vals, undefined, true);
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [isEditing, getValues, saveArticle]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
        setValue("featuredImage", data.url);
        toast.success("Image uploaded");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function runAiAction(
    key: string,
    endpoint: string,
    body: Record<string, unknown>,
    onSuccess: (data: Record<string, unknown>) => void
  ) {
    setAiBusy(key);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "AI request failed");
      } else {
        setValue("aiAssisted", true);
        onSuccess(data);
      }
    } catch {
      toast.error("Network error calling AI");
    } finally {
      setAiBusy(null);
    }
  }

  return (
    <form
      onSubmit={handleSubmit((vals) => saveArticle(vals))}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {/* Left Main Column */}
      <div className="lg:col-span-2 space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-semibold text-slate-800">Headline (शीर्षक)</label>
            <div className="flex items-center gap-2">
              {aiAssistedVal && (
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-medium">
                  AI-assisted (Human review required)
                </span>
              )}
              <button
                type="button"
                disabled={!aiAvailable || aiBusy !== null}
                title={aiDisabledReason || "Generate 5 SEO-friendly headlines"}
                onClick={() =>
                  runAiAction(
                    "headlines",
                    "/api/admin/ai/headlines",
                    { title: getValues("title"), content: getValues("content") },
                    (d) => {
                      setHeadlineChoices((d.headlines as string[]) ?? []);
                      toast.success("Generated 5 headline options");
                    }
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-50 text-purple-800 border border-purple-200 text-xs font-medium hover:bg-purple-100 disabled:opacity-45 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiBusy === "headlines" ? "Thinking..." : "AI Headlines"}
              </button>
            </div>
          </div>

          <input
            {...register("title", { required: true })}
            onBlur={(e) => {
              if (!getValues("slug") && e.target.value) {
                setValue("slug", slugify(e.target.value));
              }
            }}
            placeholder="यहाँ समाचार का शीर्षक लिखें..."
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-red-600"
          />

          {headlineChoices.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-1.5">
              <div className="text-xs font-semibold text-purple-900">Select a headline suggestion:</div>
              {headlineChoices.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setValue("title", h);
                    setHeadlineChoices([]);
                  }}
                  className="block w-full text-left text-xs px-2.5 py-1.5 rounded bg-white hover:bg-purple-100 border border-purple-100 text-slate-800 cursor-pointer"
                >
                  {h}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL Slug</label>
              <input
                {...register("slug")}
                placeholder="auto-generated-slug"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Author Name</label>
              <input
                {...register("authorName")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subtitle (उप-शीर्षक)</label>
            <input
              {...register("subtitle")}
              placeholder="संक्षिप्त उप-शीर्षक..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Story Body</label>
            <TiptapEditor
              value={contentVal}
              onChange={(html) => setValue("content", html)}
              aiAvailable={aiAvailable}
              aiDisabledReason={aiDisabledReason}
              onAiUsed={() => setValue("aiAssisted", true)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Excerpt (सारांश)</label>
            <textarea
              {...register("excerpt")}
              rows={2}
              placeholder="1-2 वाक्य का संक्षिप्त विवरण..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* 30-second AI Summary Box */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">30-Second Summary (Public AI Summary Box)</h3>
              <p className="text-xs text-slate-500">Generated once and saved. Hidden on public page if left empty.</p>
            </div>
            <button
              type="button"
              disabled={!aiAvailable || aiBusy !== null}
              title={aiDisabledReason || "Generate 3-4 bullet summary"}
              onClick={() =>
                runAiAction(
                  "summary",
                  "/api/admin/ai/summary",
                  { title: getValues("title"), content: getValues("content") },
                  (d) => {
                    setValue("aiSummary", (d.formatted as string) ?? "");
                    toast.success("30-second summary generated");
                  }
                )
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-800 text-white text-xs font-medium disabled:opacity-45 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiBusy === "summary" ? "Generating..." : "Generate AI Summary"}
            </button>
          </div>
          <textarea
            {...register("aiSummary")}
            rows={4}
            placeholder="• मुख्य बिंदु 1&#10;• मुख्य बिंदु 2"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {/* SEO Fields */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">SEO Settings</h3>
            <button
              type="button"
              disabled={!aiAvailable || aiBusy !== null}
              title={aiDisabledReason || "Auto-fill excerpt, meta title, meta description, tags, and English slug"}
              onClick={() =>
                runAiAction(
                  "seo",
                  "/api/admin/ai/seo",
                  { title: getValues("title"), content: getValues("content") },
                  (d) => {
                    if (d.excerpt) setValue("excerpt", d.excerpt as string);
                    if (d.metaTitle) setValue("metaTitle", d.metaTitle as string);
                    if (d.metaDescription) setValue("metaDescription", d.metaDescription as string);
                    if (d.slug) setValue("slug", d.slug as string);
                    if (Array.isArray(d.tags)) setValue("tagsText", d.tags.join(", "));
                    toast.success("SEO Pack applied as editable suggestions");
                  }
                )
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-xs font-medium hover:bg-purple-100 disabled:opacity-45 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiBusy === "seo" ? "Generating..." : "One-Click AI SEO Pack"}
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Meta Title (&lt;= 60 chars)</label>
            <input {...register("metaTitle")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Meta Description (&lt;= 155 chars)</label>
            <textarea
              {...register("metaDescription")}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Canonical URL (optional)</label>
            <input {...register("canonicalUrl")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="space-y-5">
        {/* Publish Box */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Publish &amp; Status</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {watch("status")}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Schedule Publish (Optional)</label>
            <input
              type="datetime-local"
              {...register("scheduledAt")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit((vals) => saveArticle(vals, "DRAFT"))}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit((vals) => saveArticle(vals, "PUBLISHED"))}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Publish
            </button>
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <a
                href={`/news/${watch("slug")}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview / Live
              </a>
              {watch("status") === "PUBLISHED" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmit((vals) => saveArticle(vals, "UNPUBLISHED"))}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-medium hover:bg-amber-100 cursor-pointer"
                >
                  Unpublish
                </button>
              )}
            </div>
          )}

          {/* Flags */}
          <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register("isFeatured")} className="rounded text-red-700" />
              <span>Featured (Hero Section)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register("isBreaking")} className="rounded text-red-700" />
              <span>Breaking News</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register("hideAds")} className="rounded text-red-700" />
              <span>Hide Ads on this Article</span>
            </label>
          </div>
        </div>

        {/* Category & Tags */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Category / City</h3>
            <button
              type="button"
              disabled={!aiAvailable || aiBusy !== null}
              title={aiDisabledReason || "Suggest category from DB"}
              onClick={() =>
                runAiAction(
                  "category",
                  "/api/admin/ai/category",
                  { title: getValues("title"), content: getValues("content") },
                  (d) => {
                    const targetId = (d.subCategoryId as string) || (d.categoryId as string);
                    if (targetId) setValue("categoryId", targetId);
                    toast.success("Category suggested");
                  }
                )
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-800 border border-purple-200 text-xs font-medium disabled:opacity-45 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              {aiBusy === "category" ? "..." : "AI Suggest"}
            </button>
          </div>

          <select
            {...register("categoryId", { required: true })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? `↳ ${c.name}` : c.name}
              </option>
            ))}
          </select>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tags (comma-separated)</label>
            <input
              {...register("tagsText")}
              placeholder="मध्य प्रदेश, भोपाल, विकास"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Featured Image */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Featured Image</h3>
            <button
              type="button"
              disabled={!aiAvailable || aiBusy !== null || !featuredImageVal}
              title={aiDisabledReason || "Suggest alt text & caption"}
              onClick={() =>
                runAiAction(
                  "imageAlt",
                  "/api/admin/ai/image-alt",
                  { imageUrl: featuredImageVal, contextTitle: titleVal, language: "hi" },
                  (d) => {
                    if (d.altText) setValue("imageAlt", d.altText as string);
                    if (d.caption) setValue("imageCaption", d.caption as string);
                    toast.success("Image alt & caption suggested");
                  }
                )
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-800 border border-purple-200 text-xs font-medium disabled:opacity-45 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              {aiBusy === "imageAlt" ? "..." : "AI Alt/Caption"}
            </button>
          </div>

          {featuredImageVal && (
            <img
              src={featuredImageVal}
              alt="Featured preview"
              className="w-full h-40 object-cover rounded-lg border border-slate-200"
            />
          )}

          <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload JPG / PNG / WebP (max 5MB)"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
          </label>

          <input
            {...register("featuredImage")}
            placeholder="Or paste image URL..."
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
          />
          <input
            {...register("imageAlt")}
            placeholder="Alt text (accessibility & SEO)"
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
          />
          <input
            {...register("imageCaption")}
            placeholder="Photo caption"
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        {/* AI Tools: Translate & Ticker */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">AI Editorial Tools</h3>

          <button
            type="button"
            disabled={!aiAvailable || aiBusy !== null}
            title={aiDisabledReason || "Generate <=90 char breaking ticker line"}
            onClick={() =>
              runAiAction(
                "ticker",
                "/api/admin/ai/ticker",
                { title: getValues("title"), content: getValues("content") },
                (d) => setTickerPreview((d.tickerText as string) ?? null)
              )
            }
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-800 text-xs font-medium hover:bg-purple-100 disabled:opacity-45 cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5" />
            {aiBusy === "ticker" ? "Generating..." : "AI Breaking Ticker Line"}
          </button>

          {tickerPreview && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
              <p className="font-medium text-slate-800">{tickerPreview}</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(tickerPreview);
                  toast.success("Copied ticker line");
                }}
                className="text-red-700 font-semibold hover:underline cursor-pointer"
              >
                Copy Ticker Text
              </button>
            </div>
          )}

          {isEditing && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={!aiAvailable || aiBusy !== null}
                title={aiDisabledReason || "Translate to English as a NEW draft"}
                onClick={() =>
                  runAiAction(
                    "translate_en",
                    "/api/admin/ai/translate",
                    { articleId: initialData!.id, targetLanguage: "en" },
                    (d) => {
                      const art = d.article as { id: string };
                      toast.success("Created English draft copy");
                      router.push(`/admin/articles/${art.id}`);
                    }
                  )
                }
                className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-medium hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
              >
                <Languages className="w-3.5 h-3.5" />
                {aiBusy === "translate_en" ? "..." : "Draft in EN"}
              </button>
              <button
                type="button"
                disabled={!aiAvailable || aiBusy !== null}
                title={aiDisabledReason || "Translate to Hindi as a NEW draft"}
                onClick={() =>
                  runAiAction(
                    "translate_hi",
                    "/api/admin/ai/translate",
                    { articleId: initialData!.id, targetLanguage: "hi" },
                    (d) => {
                      const art = d.article as { id: string };
                      toast.success("Created Hindi draft copy");
                      router.push(`/admin/articles/${art.id}`);
                    }
                  )
                }
                className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-medium hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
              >
                <Languages className="w-3.5 h-3.5" />
                {aiBusy === "translate_hi" ? "..." : "Draft in HI"}
              </button>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
