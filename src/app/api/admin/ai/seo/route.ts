import { aiGenerateSeoPack } from "@/lib/ai";
import { handleAiRoute } from "@/lib/ai/http";
import { AiSeoPackInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  return handleAiRoute(req, async (body) => {
    const input = AiSeoPackInputSchema.parse(body);
    return aiGenerateSeoPack(input);
  });
}
