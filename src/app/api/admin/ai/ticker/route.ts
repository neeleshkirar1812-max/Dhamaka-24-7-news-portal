import { aiGenerateTickerLine } from "@/lib/ai";
import { handleAiRoute } from "@/lib/ai/http";
import { AiTickerInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  return handleAiRoute(req, async (body) => {
    const input = AiTickerInputSchema.parse(body);
    return aiGenerateTickerLine(input);
  });
}
