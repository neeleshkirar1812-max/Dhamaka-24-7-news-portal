import { aiSuggestCategory } from "@/lib/ai";
import { handleAiRoute } from "@/lib/ai/http";
import { AiCategoryInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  return handleAiRoute(req, async (body) => {
    const input = AiCategoryInputSchema.parse(body);
    return aiSuggestCategory(input);
  });
}
