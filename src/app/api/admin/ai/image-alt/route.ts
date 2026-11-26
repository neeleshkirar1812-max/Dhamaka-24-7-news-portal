import { aiSuggestImageAltCaption } from "@/lib/ai";
import { handleAiRoute } from "@/lib/ai/http";
import { AiImageAltInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  return handleAiRoute(req, async (body) => {
    const input = AiImageAltInputSchema.parse(body);
    return aiSuggestImageAltCaption(input);
  });
}
