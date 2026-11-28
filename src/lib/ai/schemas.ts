import { z } from "zod";

export const AiRewriteActionSchema = z.enum([
  "rewrite",
  "shorten",
  "expand",
  "fix_grammar",
  "tone_formal",
  "tone_neutral",
  "tone_simple",
]);

export const AiRewriteInputSchema = z.object({
  text: z.string().min(1).max(8000),
  action: AiRewriteActionSchema,
  language: z.enum(["auto", "hi", "en"]).optional().default("auto"),
});

export const AiRewriteOutputSchema = z.object({
  rewrittenText: z.string().min(1),
});

export const AiSeoPackInputSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(20000),
  language: z.enum(["auto", "hi", "en"]).optional().default("auto"),
});

export const AiSeoPackOutputSchema = z.object({
  excerpt: z.string().min(1).max(400),
  metaTitle: z.string().min(1).max(70),
  metaDescription: z.string().min(1).max(170),
  tags: z.array(z.string().min(1).max(40)).min(3).max(8),
  slug: z.string().min(3).max(100),
});

export const AiHeadlinesInputSchema = z.object({
  title: z.string().max(300).optional().default(""),
  content: z.string().min(1).max(15000),
  language: z.enum(["auto", "hi", "en"]).optional().default("auto"),
});

export const AiHeadlinesOutputSchema = z.object({
  headlines: z.array(z.string().min(5).max(180)).min(3).max(5),
});

export const AiCategoryInputSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(12000),
});

export const AiCategoryOutputSchema = z.object({
  categoryId: z.string().min(1),
  subCategoryId: z.string().nullable().optional(),
  reason: z.string().max(300).optional(),
});

export const AiTranslateInputSchema = z.object({
  articleId: z.string().min(1),
  targetLanguage: z.enum(["hi", "en"]),
});

export const AiTranslateOutputSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  excerpt: z.string().min(1),
  content: z.string().min(1),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(170).optional(),
});

export const AiDraftFromNotesInputSchema = z.object({
  notes: z.string().min(10).max(12000),
  language: z.enum(["hi", "en"]).default("hi"),
  categoryId: z.string().min(1),
});

export const AiDraftFromNotesOutputSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  excerpt: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).max(8).optional().default([]),
});

export const AiImageAltInputSchema = z.object({
  imageUrl: z.string().min(1).max(1000),
  contextTitle: z.string().max(300).optional().default(""),
  language: z.enum(["hi", "en"]).optional().default("hi"),
});

export const AiImageAltOutputSchema = z.object({
  altText: z.string().min(1).max(160),
  caption: z.string().min(1).max(240),
});

export const AiTickerInputSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(6000).optional().default(""),
  language: z.enum(["auto", "hi", "en"]).optional().default("auto"),
});

export const AiTickerOutputSchema = z.object({
  tickerText: z.string().min(5).max(90),
});

export const AiSummaryInputSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(20000),
  language: z.enum(["auto", "hi", "en"]).optional().default("auto"),
});

export const AiSummaryOutputSchema = z.object({
  bullets: z.array(z.string().min(5).max(220)).min(3).max(4),
});

export const AiRevenueInsightsOutputSchema = z.object({
  summary: z.string().min(1),
  highlights: z.array(z.string()).min(1).max(5),
  recommendations: z.array(z.string()).min(1).max(5),
});

export const AutoNewsSourceCitationSchema = z.object({
  publisher: z.string().min(1).max(120),
  title: z.string().min(1).max(260),
  url: z.string().url().max(700),
});

export const AutoNewsFactCheckOutputSchema = z.object({
  verification: z.enum(["VERIFIED", "NEEDS_REVIEW", "DISPUTED"]),
  confidence: z.number().min(0).max(100),
  factCheckNotes: z.string().min(8).max(600),
  verifiedSources: z.array(AutoNewsSourceCitationSchema).max(6).optional().default([]),
  title: z.string().min(5).max(260),
  subtitle: z.string().max(350).nullable().optional(),
  excerpt: z.string().min(10).max(450),
  contentHtml: z.string().min(80),
  aiSummaryBullets: z.array(z.string().min(5).max(240)).min(3).max(4),
  tags: z.array(z.string().min(1).max(40)).min(2).max(8),
  metaTitle: z.string().min(5).max(80),
  metaDescription: z.string().min(10).max(180),
  slug: z.string().min(3).max(120),
  isBreaking: z.boolean().optional().default(false),
  imagePrompt: z.string().max(400).optional().default(""),
});
