import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiStatus } from "@/lib/ai";
import { getStorageStatus } from "@/lib/storage";

const ALLOWED_KEYS = [
  "siteName",
  "siteTagline",
  "socialFacebook",
  "socialTwitter",
  "socialYoutube",
  "defaultMetaTitle",
  "defaultMetaDescription",
  "adsenseClientId",
  "aiEnabled",
  "aiDailyLimit",
  "cloudinaryCloudName",
  "cloudinaryApiKey",
  "autoNewsEnabled",
  "autoNewsAutoPublish",
  "autoNewsMinScore",
  "autoNewsMaxPerRun",
  "autoNewsGenerateImage",
  "autoNewsIntervalMinutes",
] as const;

const SECRET_WRITE_KEYS = [
  "geminiApiKey",
  "anthropicApiKey",
  "cloudinaryApiSecret",
  "autoNewsCronSecret",
] as const;

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rows, aiStatus, storageStatus] = await Promise.all([
    prisma.setting.findMany({
      where: { key: { in: [...ALLOWED_KEYS] } },
    }),
    getAiStatus(),
    getStorageStatus(),
  ]);

  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return NextResponse.json({ settings, aiStatus, storageStatus });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = z.record(z.string(), z.string().max(1000)).parse(await req.json());

    for (const key of ALLOWED_KEYS) {
      if (body[key] !== undefined) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: body[key] },
          create: { key, value: body[key] },
        });
      }
    }

    for (const secretKey of SECRET_WRITE_KEYS) {
      const val = body[secretKey]?.trim();
      if (val) {
        await prisma.setting.upsert({
          where: { key: secretKey },
          update: { value: val },
          create: { key: secretKey, value: val },
        });
      }
    }

    revalidatePath("/");
    const [aiStatus, storageStatus] = await Promise.all([getAiStatus(), getStorageStatus()]);
    return NextResponse.json({ ok: true, aiStatus, storageStatus });
  } catch {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  }
}
