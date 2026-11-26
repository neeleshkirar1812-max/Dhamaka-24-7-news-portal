import { aiSuggestHeadlines } from "@/lib/ai";
import { handleAiRoute } from "@/lib/ai/http";
import { AiHeadlinesInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  return handleAiRoute(req, async (body) => {
    const input = AiHeadlinesInputSchema.parse(body);
    return aiSuggestHeadlines(input);
  });
}
