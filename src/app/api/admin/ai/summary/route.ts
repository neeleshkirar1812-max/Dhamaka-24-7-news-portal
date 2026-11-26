import { aiGenerateSummary } from "@/lib/ai";
import { handleAiRoute } from "@/lib/ai/http";
import { AiSummaryInputSchema } from "@/lib/ai/schemas";

export async function POST(req: Request) {
  return handleAiRoute(req, async (body) => {
    const input = AiSummaryInputSchema.parse(body);
    return aiGenerateSummary(input);
  });
}
