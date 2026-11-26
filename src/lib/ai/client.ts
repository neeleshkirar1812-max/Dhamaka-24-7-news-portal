import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "DISABLED" | "LIMIT_REACHED" | "API_ERROR" | "PARSE_ERROR" = "API_ERROR",
    public readonly status: number = 503
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

let cachedClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (typeof window !== "undefined") {
    throw new Error("Anthropic client must only be used on the server.");
  }
  if (!env.anthropicApiKey) {
    throw new AiServiceError("AI is not configured (missing API key).", "DISABLED", 503);
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({
      apiKey: env.anthropicApiKey,
      timeout: 30_000,
    });
  }
  return cachedClient;
}

export async function getAiStatus() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [enabledSetting, limitSetting, todayCalls, todayAgg] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "aiEnabled" } }),
    prisma.setting.findUnique({ where: { key: "aiDailyLimit" } }),
    prisma.aiLog.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.aiLog.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);

  const hasKey = Boolean(env.anthropicApiKey);
  const settingEnabled = enabledSetting ? enabledSetting.value !== "false" : true;
  const dailyLimit = limitSetting
    ? Math.max(1, Number.parseInt(limitSetting.value, 10) || env.aiDailyLimit)
    : env.aiDailyLimit;

  return {
    configured: hasKey,
    enabled: hasKey && settingEnabled,
    limitReached: todayCalls >= dailyLimit,
    todayCalls,
    dailyLimit,
    todayInputTokens: todayAgg._sum.inputTokens ?? 0,
    todayOutputTokens: todayAgg._sum.outputTokens ?? 0,
    model: env.aiModel,
  };
}

async function assertAiReady() {
  const status = await getAiStatus();
  if (!status.configured) {
    throw new AiServiceError("AI assistant is disabled: ANTHROPIC_API_KEY is not set.", "DISABLED", 503);
  }
  if (!status.enabled) {
    throw new AiServiceError("AI assistant is disabled in Site Settings.", "DISABLED", 503);
  }
  if (status.limitReached) {
    throw new AiServiceError(
      `Daily AI usage limit (${status.dailyLimit} calls) has been reached.`,
      "LIMIT_REACHED",
      429
    );
  }
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

type MessageContent = Anthropic.Messages.MessageParam["content"];

export async function callClaudeStructured<T>({
  feature,
  system,
  userContent,
  schema,
  maxTokens = 1500,
}: {
  feature: string;
  system: string;
  userContent: MessageContent;
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  await assertAiReady();
  const client = getAnthropicClient();

  const runAttempt = async (messages: Anthropic.Messages.MessageParam[]) => {
    try {
      const response = await client.messages.create({
        model: env.aiModel,
        max_tokens: maxTokens,
        system,
        messages,
      });

      await prisma.aiLog.create({
        data: {
          feature,
          model: env.aiModel,
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
        },
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new AiServiceError("AI returned an empty response.", "PARSE_ERROR", 502);
      }
      return textBlock.text;
    } catch (err) {
      if (err instanceof AiServiceError) throw err;
      const status = (err as { status?: number })?.status;
      if (status === 429) {
        throw new AiServiceError("AI rate limit reached. Please try again shortly.", "API_ERROR", 429);
      }
      throw new AiServiceError("AI service is temporarily unavailable. Please try again.", "API_ERROR", 502);
    }
  };

  const firstRaw = await runAttempt([{ role: "user", content: userContent }]);
  try {
    const parsed = JSON.parse(extractJsonText(firstRaw));
    return schema.parse(parsed);
  } catch {
    // Retry once on parse/validation failure
    const retryRaw = await runAttempt([
      { role: "user", content: userContent },
      { role: "assistant", content: firstRaw },
      {
        role: "user",
        content: "Your previous output was not valid JSON matching the required schema. Return ONLY valid JSON.",
      },
    ]);
    try {
      const parsed = JSON.parse(extractJsonText(retryRaw));
      return schema.parse(parsed);
    } catch {
      throw new AiServiceError("AI returned an invalid structured response.", "PARSE_ERROR", 502);
    }
  }
}
