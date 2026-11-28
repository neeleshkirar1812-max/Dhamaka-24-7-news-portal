import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { runAutoNewsCycle } from "@/lib/auto-news/engine";
import { getAutoNewsConfig } from "@/lib/auto-news/topics";

function secretsMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const h1 = crypto.createHash("sha256").update(provided).digest();
  const h2 = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(h1, h2);
}

async function handleCron(req: Request) {
  const storedSecretRow = await prisma.setting.findUnique({
    where: { key: "autoNewsCronSecret" },
  });
  const expectedSecret = (storedSecretRow?.value || env.cronSecret || "").trim();

  if (!expectedSecret) {
    return NextResponse.json(
      {
        error:
          "Cron secret is not configured. Set CRON_SECRET in Render or save Cron Secret inside AI News Desk.",
      },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  const querySecret = url.searchParams.get("secret")?.trim() ?? "";
  const provided = bearer || headerSecret || querySecret;

  if (!secretsMatch(provided, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = url.searchParams.get("force") === "1";
  const config = await getAutoNewsConfig();

  if (!config.enabled && !force) {
    return NextResponse.json({ ok: true, skipped: "Auto News engine is paused" });
  }

  if (!force && config.lastRunAt) {
    const elapsedMin = (Date.now() - new Date(config.lastRunAt).getTime()) / 60_000;
    if (elapsedMin < config.intervalMinutes - 1) {
      return NextResponse.json({
        ok: true,
        skipped: `Interval not elapsed (${Math.round(elapsedMin)}m / ${config.intervalMinutes}m)`,
      });
    }
  }

  const summary = await runAutoNewsCycle({
    force,
    trigger: "cron",
  });

  return NextResponse.json({ summary });
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
