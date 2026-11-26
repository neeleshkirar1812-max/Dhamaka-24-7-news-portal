import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
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

export type AiUserInput =
  | string
  | {
      text: string;
      imageUrl?: string;
    };

let cachedAnthropic: Anthropic | null = null;
let cachedGemini: GoogleGenAI | null = null;

function resolveProvider(): { provider: "gemini" | "anthropic" | null; model: string } {
  if (env.aiProvider === "gemini" && env.geminiApiKey) {
    return { provider: "gemini", model: env.geminiModel };
  }
  if (env.aiProvider === "anthropic" && env.anthropicApiKey) {
    return { provider: "anthropic", model: env.aiModel };
  }
  if (env.geminiApiKey) {
    return { provider: "gemini", model: env.geminiModel };
  }
  if (env.anthropicApiKey) {
    return { provider: "anthropic", model: env.aiModel };
  }
  return { provider: null, model: env.geminiModel };
}

function getAnthropicClient(): Anthropic {
  if (typeof window !== "undefined") {
    throw new Error("AI client must only be used on the server.");
  }
  if (!cachedAnthropic) {
    cachedAnthropic = new Anthropic({
      apiKey: env.anthropicApiKey,
      timeout: 30_000,
    });
  }
  return cachedAnthropic;
}

function getGeminiClient(): GoogleGenAI {
  if (typeof window !== "undefined") {
    throw new Error("AI client must only be used on the server.");
  }
  if (!cachedGemini) {
    cachedGemini = new GoogleGenAI({
      apiKey: env.geminiApiKey,
    });
  }
  return cachedGemini;
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

  const resolved = resolveProvider();
  const hasKey = resolved.provider !== null;
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
    provider: resolved.provider ?? "none",
    model: resolved.model,
  };
}

async function assertAiReady() {
  const status = await getAiStatus();
  if (!status.configured) {
    throw new AiServiceError(
      "AI assistant is disabled: set GEMINI_API_KEY (free tier) or ANTHROPIC_API_KEY.",
      "DISABLED",
      503
    );
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
  return status;
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function detectMimeType(urlOrPath: string): "image/jpeg" | "image/png" | "image/webp" {
  const lower = urlOrPath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function loadLocalImageBase64(urlPath: string): Promise<{ data: string; mimeType: "image/jpeg" | "image/png" | "image/webp" } | null> {
  if (!urlPath.startsWith("/uploads/")) return null;
  try {
    const filePath = path.join(process.cwd(), "public", urlPath);
    const buf = await fs.readFile(filePath);
    return { data: buf.toString("base64"), mimeType: detectMimeType(urlPath) };
  } catch {
    return null;
  }
}

async function callGeminiText({
  feature,
  model,
  system,
  userInput,
  maxTokens,
  retryFrom,
}: {
  feature: string;
  model: string;
  system: string;
  userInput: AiUserInput;
  maxTokens: number;
  retryFrom?: string;
}): Promise<string> {
  const gemini = getGeminiClient();

  const textPrompt = typeof userInput === "string" ? userInput : userInput.text;
  const finalPrompt = retryFrom
    ? `${textPrompt}\n\nPrevious invalid output:\n${retryFrom}\n\nYour previous output was not valid JSON matching the required schema. Return ONLY valid JSON.`
    : textPrompt;

  type GeminiInput =
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image"; uri?: string; data?: string; mime_type?: "image/jpeg" | "image/png" | "image/webp" }
      >;

  let input: GeminiInput = finalPrompt;
  if (typeof userInput !== "string" && userInput.imageUrl) {
    const imgUrl = userInput.imageUrl;
    if (/^https?:\/\//i.test(imgUrl)) {
      input = [
        { type: "text", text: finalPrompt },
        { type: "image", uri: imgUrl, mime_type: detectMimeType(imgUrl) },
      ];
    } else {
      const localImg = await loadLocalImageBase64(imgUrl);
      if (localImg) {
        input = [
          { type: "text", text: finalPrompt },
          { type: "image", data: localImg.data, mime_type: localImg.mimeType },
        ];
      } else {
        input = `${finalPrompt}\nImage filename/path: ${imgUrl}`;
      }
    }
  }

  try {
    const interaction = await gemini.interactions.create({
      model,
      system_instruction: system,
      input,
      generation_config: {
        max_output_tokens: maxTokens,
      },
      response_mime_type: "application/json",
      store: false,
    });

    await prisma.aiLog.create({
      data: {
        feature,
        model,
        inputTokens: interaction.usage?.total_input_tokens ?? 0,
        outputTokens: interaction.usage?.total_output_tokens ?? 0,
      },
    });

    const text = interaction.output_text;
    if (!text) {
      throw new AiServiceError("AI returned an empty response.", "PARSE_ERROR", 502);
    }
    return text;
  } catch (err) {
    if (err instanceof AiServiceError) throw err;
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      throw new AiServiceError("AI rate limit reached. Please try again shortly.", "API_ERROR", 429);
    }
    throw new AiServiceError("AI service is temporarily unavailable. Please try again.", "API_ERROR", 502);
  }
}

async function callAnthropicText({
  feature,
  model,
  system,
  userInput,
  maxTokens,
  retryFrom,
}: {
  feature: string;
  model: string;
  system: string;
  userInput: AiUserInput;
  maxTokens: number;
  retryFrom?: string;
}): Promise<string> {
  const client = getAnthropicClient();

  let userContent: Anthropic.Messages.MessageParam["content"];
  if (typeof userInput === "string") {
    userContent = userInput;
  } else if (userInput.imageUrl && /^https?:\/\//i.test(userInput.imageUrl)) {
    userContent = [
      { type: "image", source: { type: "url", url: userInput.imageUrl } },
      { type: "text", text: userInput.text },
    ];
  } else {
    userContent = userInput.imageUrl
      ? `${userInput.text}\nImage filename/path: ${userInput.imageUrl}`
      : userInput.text;
  }

  const messages: Anthropic.Messages.MessageParam[] = retryFrom
    ? [
        { role: "user", content: userContent },
        { role: "assistant", content: retryFrom },
        {
          role: "user",
          content: "Your previous output was not valid JSON matching the required schema. Return ONLY valid JSON.",
        },
      ]
    : [{ role: "user", content: userContent }];

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    });

    await prisma.aiLog.create({
      data: {
        feature,
        model,
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
}

export async function callAiStructured<T>({
  feature,
  system,
  userContent,
  schema,
  maxTokens = 1500,
}: {
  feature: string;
  system: string;
  userContent: AiUserInput;
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  const status = await assertAiReady();

  const invoke = (retryFrom?: string) =>
    status.provider === "gemini"
      ? callGeminiText({
          feature,
          model: status.model,
          system,
          userInput: userContent,
          maxTokens,
          retryFrom,
        })
      : callAnthropicText({
          feature,
          model: status.model,
          system,
          userInput: userContent,
          maxTokens,
          retryFrom,
        });

  const firstRaw = await invoke();
  try {
    const parsed = JSON.parse(extractJsonText(firstRaw));
    return schema.parse(parsed);
  } catch {
    const retryRaw = await invoke(firstRaw);
    try {
      const parsed = JSON.parse(extractJsonText(retryRaw));
      return schema.parse(parsed);
    } catch {
      throw new AiServiceError("AI returned an invalid structured response.", "PARSE_ERROR", 502);
    }
  }
}
