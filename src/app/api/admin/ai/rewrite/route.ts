import { aiRewriteText } from "@/lib/ai";
import { handleAiRoute } from "@/lib/ai/http";
import { AiRewriteInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  return handleAiRoute(req, async (body) => {
    const input = AiRewriteInputSchema.parse(body);
    return aiRewriteText(input);
  });
}
