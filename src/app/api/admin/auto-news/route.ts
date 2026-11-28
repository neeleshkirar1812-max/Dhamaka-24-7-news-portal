import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getAiStatus } from "@/lib/ai";
import { isSafePublicHttpUrl } from "@/lib/auto-news/feeds";
import {
  ensureDefaultAutoNewsTopics,
  getAutoNewsConfig,
  resolveOrCreateCityCategory,
} from "@/lib/auto-news/topics";

const TopicCreateSchema = z.object({
  name: z.string().min(2).max(100),
  scope: z.enum(["GLOBAL", "NATIONAL", "STATE", "CITY"]).default("CITY"),
  query: z.string().min(2).max(200),
  categoryId: z.string().optional(),
  autoCreateCategory: z.boolean().optional().default(false),
  rssUrl: z.string().max(500).optional().nullable(),
  priority: z.number().int().min(0).max(200).optional().default(60),
});

const PatchSchema = z.union([
  z.object({
    id: z.string().min(1),
    isActive: z.boolean().optional(),
    query: z.string().min(2).max(200).optional(),
    rssUrl: z.string().max(500).optional().nullable(),
    priority: z.number().int().min(0).max(200).optional(),
  }),
  z.object({
    settings: z.object({
      enabled: z.boolean().optional(),
      autoPublish: z.boolean().optional(),
      minScore: z.number().int().min(50).max(98).optional(),
      maxPerRun: z.number().int().min(1).max(8).optional(),
      generateImage: z.boolean().optional(),
      intervalMinutes: z.number().int().min(15).max(1440).optional(),
      cronSecret: z.string().max(200).optional(),
    }),
  }),
]);

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDefaultAutoNewsTopics();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [config, aiStatus, topics, logs, categories, publishedToday, draftsToday, rejectedToday] =
    await Promise.all([
      getAutoNewsConfig(),
      getAiStatus(),
      prisma.autoNewsTopic.findMany({
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.autoNewsLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.category.findMany({
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true, parentId: true },
      }),
      prisma.autoNewsLog.count({ where: { createdAt: { gte: startOfDay }, outcome: "PUBLISHED" } }),
      prisma.autoNewsLog.count({ where: { createdAt: { gte: startOfDay }, outcome: "DRAFT" } }),
      prisma.autoNewsLog.count({ where: { createdAt: { gte: startOfDay }, outcome: "REJECTED" } }),
    ]);

  return NextResponse.json({
    config,
    aiStatus,
    topics,
    logs,
    categories,
    siteUrl: env.siteUrl,
    stats: { publishedToday, draftsToday, rejectedToday },
  });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const raw = await req.json();
    const data = TopicCreateSchema.parse(raw);

    const rssTrimmed = data.rssUrl?.trim() || null;
    if (rssTrimmed && !isSafePublicHttpUrl(rssTrimmed)) {
      return NextResponse.json(
        { error: "RSS URL must be a valid public http(s) URL." },
        { status: 400 }
      );
    }

    const categoryId = await resolveOrCreateCityCategory(
      data.name,
      data.categoryId,
      data.autoCreateCategory
    );

    const topic = await prisma.autoNewsTopic.upsert({
      where: {
        name_scope: { name: data.name.trim(), scope: data.scope },
      },
      update: {
        query: data.query.trim(),
        categoryId,
        rssUrl: rssTrimmed,
        priority: data.priority,
        isActive: true,
      },
      create: {
        name: data.name.trim(),
        scope: data.scope,
        query: data.query.trim(),
        categoryId,
        rssUrl: rssTrimmed,
        priority: data.priority,
        isActive: true,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    if (data.autoCreateCategory) {
      revalidatePath("/");
    }

    return NextResponse.json({ topic }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save city/region tracker";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = PatchSchema.parse(await req.json());

    if ("settings" in parsed) {
      const s = parsed.settings;
      const updates: Array<[string, string]> = [];
      if (s.enabled !== undefined) updates.push(["autoNewsEnabled", String(s.enabled)]);
      if (s.autoPublish !== undefined) updates.push(["autoNewsAutoPublish", String(s.autoPublish)]);
      if (s.minScore !== undefined) updates.push(["autoNewsMinScore", String(s.minScore)]);
      if (s.maxPerRun !== undefined) updates.push(["autoNewsMaxPerRun", String(s.maxPerRun)]);
      if (s.generateImage !== undefined) {
        updates.push(["autoNewsGenerateImage", String(s.generateImage)]);
      }
      if (s.intervalMinutes !== undefined) {
        updates.push(["autoNewsIntervalMinutes", String(s.intervalMinutes)]);
      }
      if (s.cronSecret?.trim()) {
        updates.push(["autoNewsCronSecret", s.cronSecret.trim()]);
      }

      for (const [key, value] of updates) {
        await prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
      const config = await getAutoNewsConfig();
      return NextResponse.json({ ok: true, config });
    }

    if (parsed.rssUrl && parsed.rssUrl.trim() && !isSafePublicHttpUrl(parsed.rssUrl)) {
      return NextResponse.json(
        { error: "RSS URL must be a valid public http(s) URL." },
        { status: 400 }
      );
    }

    const topic = await prisma.autoNewsTopic.update({
      where: { id: parsed.id },
      data: {
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
        ...(parsed.query !== undefined ? { query: parsed.query.trim() } : {}),
        ...(parsed.rssUrl !== undefined ? { rssUrl: parsed.rssUrl?.trim() || null } : {}),
        ...(parsed.priority !== undefined ? { priority: parsed.priority } : {}),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({ topic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Topic id required" }, { status: 400 });
  }

  await prisma.autoNewsTopic.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
