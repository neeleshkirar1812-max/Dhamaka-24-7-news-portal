import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { AiServiceError } from "@/lib/ai";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Shared wrapper for all /api/admin/ai/* endpoints:
 * enforces admin session, per-IP rate limiting, Zod validation, and safe error responses.
 */
export async function handleAiRoute<T>(
  req: Request,
  handler: (body: unknown) => Promise<T>
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req.headers);
  const rate = checkRateLimit(`ai:${ip}`, 30, 60 * 1000); // 30 AI requests/min
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many AI requests. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const result = await handler(body);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    if (err instanceof AiServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "AI assistant encountered an error. Please try again." },
      { status: 500 }
    );
  }
}
