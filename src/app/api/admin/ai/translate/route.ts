import { aiTranslateArticle } from "@/lib/ai";
import { handleAiRoute } from "@/lib/ai/http";
import { AiTranslateInputSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function POST(req: Request) {
  return handleAiRoute(req, async (body) => {
    const input = AiTranslateInputSchema.parse(body);
    const source = await prisma.article.findUnique({ where: { id: input.articleId } });
    if (!source) {
      throw new Error("Source article not found");
    }

    const translated = await aiTranslateArticle(input);
    const baseSlug = slugify(translated.title, "news");
    const uniqueSlug = `${baseSlug}-${input.targetLanguage}-${Date.now().toString(36).slice(-4)}`;

    const draft = await prisma.article.create({
      data: {
        title: translated.title,
        slug: uniqueSlug,
        subtitle: translated.subtitle ?? null,
        excerpt: translated.excerpt,
        content: translated.content,
        featuredImage: source.featuredImage,
        imageCaption: source.imageCaption,
        imageAlt: source.imageAlt,
        status: "DRAFT",
        authorName: source.authorName,
        categoryId: source.categoryId,
        metaTitle: translated.metaTitle ?? translated.title.slice(0, 60),
        metaDescription: translated.metaDescription ?? translated.excerpt.slice(0, 155),
        aiAssisted: true,
      },
    });

    return { article: draft };
  });
}
