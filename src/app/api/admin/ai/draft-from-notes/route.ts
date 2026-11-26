import { aiDraftFromNotes } from "@/lib/ai";
import { handleAiRoute } from "@/lib/ai/http";
import { AiDraftFromNotesInputSchema } from "@/lib/ai/schemas";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export async function POST(req: Request) {
  return handleAiRoute(req, async (body) => {
    const input = AiDraftFromNotesInputSchema.parse(body);
    const drafted = await aiDraftFromNotes(input);
    const uniqueSlug = `${slugify(drafted.title, "draft")}-${Date.now().toString(36).slice(-4)}`;

    const draft = await prisma.article.create({
      data: {
        title: drafted.title,
        slug: uniqueSlug,
        subtitle: drafted.subtitle ?? null,
        excerpt: drafted.excerpt,
        content: drafted.content,
        status: "DRAFT",
        categoryId: input.categoryId,
        aiAssisted: true,
      },
    });

    return { article: draft, tags: drafted.tags };
  });
}
