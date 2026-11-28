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

let cachedAnthropic: { key: string; client: Anthropic } | null = null;
let cachedGemini: { key: string; client: GoogleGenAI } | null = null;

function cleanKey(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

async function getStoredAiKeys(): Promise<{ geminiKey: string; anthropicKey: string }> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["geminiApiKey", "anthropicApiKey"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, cleanKey(r.value)]));
  return {
    geminiKey: map.geminiApiKey || cleanKey(env.geminiApiKey),
    anthropicKey: map.anthropicApiKey || cleanKey(env.anthropicApiKey),
  };
}

function resolveProvider(keys: { geminiKey: string; anthropicKey: string }): {
  provider: "gemini" | "anthropic" | null;
  model: string;
  apiKey: string;
} {
  if (env.aiProvider === "gemini" && keys.geminiKey) {
    return { provider: "gemini", model: env.geminiModel, apiKey: keys.geminiKey };
  }
  if (env.aiProvider === "anthropic" && keys.anthropicKey) {
    return { provider: "anthropic", model: env.aiModel, apiKey: keys.anthropicKey };
  }
  if (keys.geminiKey) {
    return { provider: "gemini", model: env.geminiModel, apiKey: keys.geminiKey };
  }
  if (keys.anthropicKey) {
    return { provider: "anthropic", model: env.aiModel, apiKey: keys.anthropicKey };
  }
  return { provider: null, model: env.geminiModel, apiKey: "" };
}

function getAnthropicClient(apiKey: string): Anthropic {
  if (typeof window !== "undefined") {
    throw new Error("AI client must only be used on the server.");
  }
  if (!cachedAnthropic || cachedAnthropic.key !== apiKey) {
    cachedAnthropic = {
      key: apiKey,
      client: new Anthropic({
        apiKey,
        timeout: 30_000,
      }),
    };
  }
  return cachedAnthropic.client;
}

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (typeof window !== "undefined") {
    throw new Error("AI client must only be used on the server.");
  }
  if (!cachedGemini || cachedGemini.key !== apiKey) {
    cachedGemini = {
      key: apiKey,
      client: new GoogleGenAI({ apiKey }),
    };
  }
  return cachedGemini.client;
}

export async function getAiStatus() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [enabledSetting, limitSetting, todayCalls, todayAgg, keys] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "aiEnabled" } }),
    prisma.setting.findUnique({ where: { key: "aiDailyLimit" } }),
    prisma.aiLog.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.aiLog.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    getStoredAiKeys(),
  ]);

  const resolved = resolveProvider(keys);
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
  const [status, keys] = await Promise.all([getAiStatus(), getStoredAiKeys()]);
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
  const resolved = resolveProvider(keys);
  return { ...status, apiKey: resolved.apiKey };
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
  if (!urlPath.startsWith("/uploads/") && !urlPath.startsWith("/api/uploads/")) return null;
  try {
    const fileName = path.basename(urlPath);
    const filePath = path.join(process.cwd(), "public", "uploads", fileName);
    const buf = await fs.readFile(filePath);
    return { data: buf.toString("base64"), mimeType: detectMimeType(urlPath) };
  } catch {
    return null;
  }
}

function formatSafeAiError(err: unknown): {
  status?: number;
  isInvalidKey: boolean;
  detail: string;
} {
  const rawStatus =
    (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;
  const rawBody = typeof (err as { body?: string })?.body === "string"
    ? (err as { body: string }).body
    : "";

  let extractedMessage = "";
  let isInvalidKey = rawStatus === 401 || rawStatus === 403;

  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody) as unknown;
      const item = Array.isArray(parsed) ? parsed[0] : parsed;
      const errObj = (item as { error?: { message?: string; status?: string } })?.error;
      if (errObj?.message) extractedMessage = errObj.message;
      if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(rawBody)) {
        isInvalidKey = true;
      }
    } catch {
      extractedMessage = rawBody;
    }
  }

  if (!extractedMessage) {
    extractedMessage = err instanceof Error ? err.message : String(err ?? "");
  }

  const scrubbed = extractedMessage
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED]")
    .replace(/AQ\.[0-9A-Za-z_.-]{10,}/g, "[REDACTED]")
    .replace(/sk-ant-[0-9A-Za-z_-]{10,}/g, "[REDACTED]")
    .replace(/([?&]key=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);

  if (isInvalidKey) {
    return {
      status: rawStatus,
      isInvalidKey: true,
      detail: `Gemini API key invalid or rejected${rawStatus ? ` (HTTP ${rawStatus})` : ""}: ${scrubbed}. Open Admin -> Settings and save a valid Google Gemini API key.`,
    };
  }
  return {
    status: rawStatus,
    isInvalidKey: false,
    detail: `AI service error${rawStatus ? ` (HTTP ${rawStatus})` : ""}: ${scrubbed || "temporarily unavailable"}`,
  };
}

async function callGeminiText({
  apiKey,
  feature,
  model,
  system,
  userInput,
  maxTokens,
  retryFrom,
  useSearch = false,
}: {
  apiKey: string;
  feature: string;
  model: string;
  system: string;
  userInput: AiUserInput;
  maxTokens: number;
  retryFrom?: string;
  useSearch?: boolean;
}): Promise<string> {
  const gemini = getGeminiClient(apiKey);

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

  const baseModels = Array.from(
    new Set([
      model,
      "gemini-3.5-flash-lite",
      "gemini-4-hydrogen",
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
    ])
  );
  const candidates: Array<{ model: string; withSearch: boolean }> = [
    ...baseModels.map((m) => ({ model: m, withSearch: useSearch })),
    ...(useSearch ? baseModels.slice(0, 2).map((m) => ({ model: m, withSearch: false })) : []),
  ];

  let lastErr: unknown;
  for (const candidate of candidates) {
    try {
      const interaction = await gemini.interactions.create({
        model: candidate.model,
        system_instruction: system,
        input,
        ...(candidate.withSearch ? { tools: [{ type: "google_search" as const }] } : {}),
        generation_config: {
          max_output_tokens: maxTokens,
        },
        store: false,
      });

      await prisma.aiLog.create({
        data: {
          feature: candidate.withSearch ? `${feature}:grounded` : feature,
          model: candidate.model,
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
      lastErr = err;
      const info = formatSafeAiError(err);
      const status = info.status;
      if (status === 429) {
        throw new AiServiceError("AI rate limit reached. Please try again shortly.", "API_ERROR", 429);
      }
      if (info.isInvalidKey) {
        throw new AiServiceError(info.detail, "API_ERROR", status || 400);
      }
      // Retry fallback model/mode on 503 overload, 400 tool/param mismatch, or 404 model unavailability
      if (status === 503 || status === 400 || status === 404) {
        continue;
      }
      throw new AiServiceError(info.detail, "API_ERROR", 502);
    }
  }

  const finalInfo = formatSafeAiError(lastErr);
  if (finalInfo.status === 429) {
    throw new AiServiceError("AI rate limit reached. Please try again shortly.", "API_ERROR", 429);
  }
  throw new AiServiceError(finalInfo.detail, "API_ERROR", 502);
}

async function callAnthropicText({
  apiKey,
  feature,
  model,
  system,
  userInput,
  maxTokens,
  retryFrom,
}: {
  apiKey: string;
  feature: string;
  model: string;
  system: string;
  userInput: AiUserInput;
  maxTokens: number;
  retryFrom?: string;
}): Promise<string> {
  const client = getAnthropicClient(apiKey);

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
  useSearch = false,
}: {
  feature: string;
  system: string;
  userContent: AiUserInput;
  schema: z.ZodType<T>;
  maxTokens?: number;
  useSearch?: boolean;
}): Promise<T> {
  const status = await assertAiReady();

  const invoke = (retryFrom?: string) =>
    status.provider === "gemini"
      ? callGeminiText({
          apiKey: status.apiKey,
          feature,
          model: status.model,
          system,
          userInput: userContent,
          maxTokens,
          retryFrom,
          useSearch,
        })
      : callAnthropicText({
          apiKey: status.apiKey,
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

/**
 * Generates an editorial news illustration using Gemini Nano Banana 2.1 when enabled.
 * Returns null gracefully if quota, model availability, or key restricts image generation.
 */
export async function generateEditorialImage(
  prompt: string
): Promise<{ buffer: Buffer; mimeType: "image/png" | "image/jpeg" | "image/webp" } | null> {
  const status = await assertAiReady().catch(() => null);
  if (!status || status.provider !== "gemini" || !prompt.trim()) return null;

  const gemini = getGeminiClient(status.apiKey);
  try {
    const interaction = await gemini.interactions.create({
      model: "gemini-nano-banana-2.1",
      input: prompt.trim(),
      response_modalities: ["image"],
      generation_config: {
        image_config: {
          aspect_ratio: "16:9",
          image_size: "1K",
        },
      },
      store: false,
    });

    await prisma.aiLog.create({
      data: {
        feature: "auto_news_image",
        model: "gemini-nano-banana-2.1",
        inputTokens: interaction.usage?.total_input_tokens ?? 0,
        outputTokens: interaction.usage?.total_output_tokens ?? 0,
      },
    });

    const img = interaction.output_image;
    if (!img?.data) return null;
    const mimeType: "image/jpeg" | "image/png" | "image/webp" =
      img.mime_type === "image/jpeg"
        ? "image/jpeg"
        : img.mime_type === "image/webp"
          ? "image/webp"
          : "image/png";
    return { buffer: Buffer.from(img.data, "base64"), mimeType };
  } catch {
    return null;
  }
}
