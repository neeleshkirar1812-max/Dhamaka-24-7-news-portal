import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sanitizeArticleHtml, stripHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/slugify";
import { callAiStructured } from "./client";
import { PROMPTS } from "./prompts";
import {
  AiCategoryInputSchema,
  AiCategoryOutputSchema,
  AiDraftFromNotesInputSchema,
  AiDraftFromNotesOutputSchema,
  AiHeadlinesInputSchema,
  AiHeadlinesOutputSchema,
  AiImageAltInputSchema,
  AiImageAltOutputSchema,
  AiRevenueInsightsOutputSchema,
  AiRewriteInputSchema,
  AiRewriteOutputSchema,
  AiSeoPackInputSchema,
  AiSeoPackOutputSchema,
  AiSummaryInputSchema,
  AiSummaryOutputSchema,
  AiTickerInputSchema,
  AiTickerOutputSchema,
  AiTranslateInputSchema,
  AiTranslateOutputSchema,
} from "./schemas";

export { AiServiceError, getAiStatus } from "./client";

function wrapUntrusted(label: string, text: string): string {
  return `<untrusted_data label="${label}">\n${text}\n</untrusted_data>`;
}

export async function aiRewriteText(input: z.infer<typeof AiRewriteInputSchema>) {
  const data = AiRewriteInputSchema.parse(input);
  const actionInstructions: Record<typeof data.action, string> = {
    rewrite: "Rewrite clearly for better journalistic flow while keeping all facts.",
    shorten: "Shorten by ~30-40% without losing key facts.",
    expand: "Expand slightly with clearer context and transitions without inventing any new facts.",
    fix_grammar: "Fix spelling, grammar, and punctuation errors only.",
    tone_formal: "Adjust tone to formal newsroom style.",
    tone_neutral: "Adjust tone to neutral, objective news reporting.",
    tone_simple: "Simplify language so general readers can understand easily.",
  };

  const langNote = data.language === "auto" ? "Match input language." : `Output in ${data.language === "hi" ? "Hindi (Devanagari)" : "English"}.`;
  const userContent = `Action: ${actionInstructions[data.action]}\n${langNote}\n\n${wrapUntrusted("selection", data.text)}`;

  const result = await callAiStructured({
    feature: `rewrite:${data.action}`,
    system: PROMPTS.rewrite,
    userContent,
    schema: AiRewriteOutputSchema,
    maxTokens: 1200,
  });

  return { rewrittenText: stripHtml(result.rewrittenText) };
}

export async function aiGenerateSeoPack(input: z.infer<typeof AiSeoPackInputSchema>) {
  const data = AiSeoPackInputSchema.parse(input);
  const plainBody = stripHtml(data.content).slice(0, 6000);
  const langNote = data.language === "auto" ? "Match article language." : `Output in ${data.language === "hi" ? "Hindi" : "English"}.`;

  const result = await callAiStructured({
    feature: "seo_pack",
    system: PROMPTS.seoPack,
    userContent: `${langNote}\n\n${wrapUntrusted("title", data.title)}\n\n${wrapUntrusted("body", plainBody)}`,
    schema: AiSeoPackOutputSchema,
    maxTokens: 800,
  });

  return {
    ...result,
    slug: slugify(result.slug || data.title),
  };
}

export async function aiSuggestHeadlines(input: z.infer<typeof AiHeadlinesInputSchema>) {
  const data = AiHeadlinesInputSchema.parse(input);
  const plainBody = stripHtml(data.content).slice(0, 5000);
  const langNote = data.language === "auto" ? "Match article language." : `Output in ${data.language === "hi" ? "Hindi" : "English"}.`;

  return callAiStructured({
    feature: "headlines",
    system: PROMPTS.headlines,
    userContent: `${langNote}\n\n${wrapUntrusted("current_title", data.title)}\n\n${wrapUntrusted("body", plainBody)}`,
    schema: AiHeadlinesOutputSchema,
    maxTokens: 600,
  });
}

export async function aiSuggestCategory(input: z.infer<typeof AiCategoryInputSchema>) {
  const data = AiCategoryInputSchema.parse(input);
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, slug: true, parentId: true },
  });

  const plainBody = stripHtml(data.content).slice(0, 4000);
  const result = await callAiStructured({
    feature: "suggest_category",
    system: PROMPTS.category,
    userContent: `Available categories JSON:\n${JSON.stringify(categories)}\n\n${wrapUntrusted("title", data.title)}\n\n${wrapUntrusted("body", plainBody)}`,
    schema: AiCategoryOutputSchema,
    maxTokens: 300,
  });

  const validCat = categories.find((c) => c.id === result.categoryId);
  const validSub = result.subCategoryId
    ? categories.find((c) => c.id === result.subCategoryId)
    : null;

  return {
    categoryId: validCat ? validCat.id : categories[0]?.id ?? "",
    subCategoryId: validSub ? validSub.id : null,
    reason: result.reason ?? "",
  };
}

export async function aiTranslateArticle(input: z.infer<typeof AiTranslateInputSchema>) {
  const data = AiTranslateInputSchema.parse(input);
  const article = await prisma.article.findUnique({
    where: { id: data.articleId },
  });
  if (!article) {
    throw new Error("Article not found");
  }

  const targetLabel = data.targetLanguage === "hi" ? "Hindi (Devanagari)" : "English";
  const result = await callAiStructured({
    feature: `translate:${data.targetLanguage}`,
    system: PROMPTS.translate,
    userContent: `Target language: ${targetLabel}\n\n${wrapUntrusted("title", article.title)}\n${wrapUntrusted("subtitle", article.subtitle ?? "")}\n${wrapUntrusted("excerpt", article.excerpt ?? "")}\n${wrapUntrusted("content_html", article.content.slice(0, 14000))}`,
    schema: AiTranslateOutputSchema,
    maxTokens: 3500,
  });

  return {
    ...result,
    content: sanitizeArticleHtml(result.content),
  };
}

export async function aiDraftFromNotes(input: z.infer<typeof AiDraftFromNotesInputSchema>) {
  const data = AiDraftFromNotesInputSchema.parse(input);
  const langLabel = data.language === "hi" ? "Hindi (Devanagari)" : "English";

  const result = await callAiStructured({
    feature: "draft_from_notes",
    system: PROMPTS.draftFromNotes,
    userContent: `Output language: ${langLabel}\n\n${wrapUntrusted("press_notes", data.notes)}`,
    schema: AiDraftFromNotesOutputSchema,
    maxTokens: 2500,
  });

  return {
    ...result,
    content: sanitizeArticleHtml(result.content),
  };
}

export async function aiSuggestImageAltCaption(input: z.infer<typeof AiImageAltInputSchema>) {
  const data = AiImageAltInputSchema.parse(input);
  const langLabel = data.language === "hi" ? "Hindi (Devanagari)" : "English";

  return callAiStructured({
    feature: "image_alt_caption",
    system: PROMPTS.imageAlt,
    userContent: {
      imageUrl: data.imageUrl,
      text: `Language: ${langLabel}\n${wrapUntrusted("article_context", data.contextTitle)}`,
    },
    schema: AiImageAltOutputSchema,
    maxTokens: 400,
  });
}

export async function aiGenerateTickerLine(input: z.infer<typeof AiTickerInputSchema>) {
  const data = AiTickerInputSchema.parse(input);
  const langNote = data.language === "auto" ? "Match article language." : `Output in ${data.language === "hi" ? "Hindi" : "English"}.`;
  const plainBody = stripHtml(data.content).slice(0, 2000);

  return callAiStructured({
    feature: "ticker_line",
    system: PROMPTS.ticker,
    userContent: `${langNote}\n\n${wrapUntrusted("title", data.title)}\n${wrapUntrusted("body", plainBody)}`,
    schema: AiTickerOutputSchema,
    maxTokens: 200,
  });
}

export async function aiGenerateSummary(input: z.infer<typeof AiSummaryInputSchema>) {
  const data = AiSummaryInputSchema.parse(input);
  const langNote = data.language === "auto" ? "Match article language." : `Output in ${data.language === "hi" ? "Hindi" : "English"}.`;
  const plainBody = stripHtml(data.content).slice(0, 8000);

  const result = await callAiStructured({
    feature: "summary",
    system: PROMPTS.summary,
    userContent: `${langNote}\n\n${wrapUntrusted("title", data.title)}\n\n${wrapUntrusted("body", plainBody)}`,
    schema: AiSummaryOutputSchema,
    maxTokens: 600,
  });

  return {
    bullets: result.bullets,
    formatted: result.bullets.map((b) => `• ${b}`).join("\n"),
  };
}

export async function aiGenerateRevenueInsights(aggregatedMetrics: Record<string, unknown>) {
  return callAiStructured({
    feature: "revenue_insights",
    system: PROMPTS.revenueInsights,
    userContent: `Aggregated ad & revenue metrics (no PII):\n${JSON.stringify(aggregatedMetrics)}`,
    schema: AiRevenueInsightsOutputSchema,
    maxTokens: 900,
  });
}
