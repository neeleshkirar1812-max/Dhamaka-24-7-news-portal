import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export interface AutoNewsConfig {
  enabled: boolean;
  autoPublish: boolean;
  minScore: number;
  maxPerRun: number;
  generateImage: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  hasCronSecret: boolean;
}

const DEFAULT_TOPICS_SPEC = [
  {
    name: "विदेश (Global)",
    scope: "GLOBAL",
    query: "world breaking news international headlines",
    preferredSlugs: ["world", "international"],
    priority: 100,
  },
  {
    name: "देश (India National)",
    scope: "NATIONAL",
    query: "India national government breaking news",
    preferredSlugs: ["india", "national"],
    priority: 95,
  },
  {
    name: "मध्य प्रदेश (State)",
    scope: "STATE",
    query: "Madhya Pradesh सरकार योजना समाचार",
    preferredSlugs: ["madhya-pradesh"],
    priority: 90,
  },
  {
    name: "भोपाल",
    scope: "CITY",
    query: "Bhopal Madhya Pradesh latest news",
    preferredSlugs: ["bhopal", "madhya-pradesh"],
    priority: 85,
  },
  {
    name: "इंदौर",
    scope: "CITY",
    query: "Indore Madhya Pradesh latest news",
    preferredSlugs: ["indore", "madhya-pradesh"],
    priority: 85,
  },
  {
    name: "ग्वालियर",
    scope: "CITY",
    query: "Gwalior Madhya Pradesh latest news",
    preferredSlugs: ["gwalior", "madhya-pradesh"],
    priority: 80,
  },
  {
    name: "जबलपुर",
    scope: "CITY",
    query: "Jabalpur Madhya Pradesh latest news",
    preferredSlugs: ["jabalpur", "madhya-pradesh"],
    priority: 80,
  },
  {
    name: "उज्जैन",
    scope: "CITY",
    query: "Ujjain Mahakal Madhya Pradesh news",
    preferredSlugs: ["ujjain", "madhya-pradesh"],
    priority: 80,
  },
  {
    name: "सागर",
    scope: "CITY",
    query: "Sagar Madhya Pradesh latest news",
    preferredSlugs: ["sagar", "madhya-pradesh"],
    priority: 75,
  },
  {
    name: "रीवा",
    scope: "CITY",
    query: "Rewa Madhya Pradesh latest news",
    preferredSlugs: ["rewa", "madhya-pradesh"],
    priority: 75,
  },
  {
    name: "रतलाम",
    scope: "CITY",
    query: "Ratlam Madhya Pradesh latest news",
    preferredSlugs: ["ratlam", "madhya-pradesh"],
    priority: 75,
  },
  {
    name: "राहतगांव",
    scope: "CITY",
    query: "Rahatgaon Harda Madhya Pradesh news",
    preferredSlugs: ["rahatgaon", "madhya-pradesh"],
    priority: 70,
  },
] as const;

export async function getAutoNewsConfig(): Promise<AutoNewsConfig> {
  const keys = [
    "autoNewsEnabled",
    "autoNewsAutoPublish",
    "autoNewsMinScore",
    "autoNewsMaxPerRun",
    "autoNewsGenerateImage",
    "autoNewsIntervalMinutes",
    "autoNewsLastRunAt",
    "autoNewsCronSecret",
  ];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    enabled: map.autoNewsEnabled !== "false",
    autoPublish: map.autoNewsAutoPublish !== "false",
    minScore: Math.min(98, Math.max(50, Number.parseInt(map.autoNewsMinScore ?? "80", 10) || 80)),
    maxPerRun: Math.min(8, Math.max(1, Number.parseInt(map.autoNewsMaxPerRun ?? "3", 10) || 3)),
    generateImage: map.autoNewsGenerateImage !== "false",
    intervalMinutes: Math.min(
      1440,
      Math.max(15, Number.parseInt(map.autoNewsIntervalMinutes ?? "60", 10) || 60)
    ),
    lastRunAt: map.autoNewsLastRunAt || null,
    hasCronSecret: Boolean(map.autoNewsCronSecret?.trim() || process.env.CRON_SECRET?.trim()),
  };
}

/**
 * Populates default Global, National, State, and MP City topics once (guarded by v2 seed flag).
 */
export async function ensureDefaultAutoNewsTopics(): Promise<void> {
  const seeded = await prisma.setting.findUnique({ where: { key: "autoNewsDefaultsSeeded" } });
  if (seeded?.value === "v2") return;

  const categories = await prisma.category.findMany({ orderBy: { order: "asc" } });
  if (categories.length === 0) return;

  const bySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const fallbackCategoryId = categories[0].id;

  for (const spec of DEFAULT_TOPICS_SPEC) {
    let categoryId = fallbackCategoryId;
    for (const s of spec.preferredSlugs) {
      const found = bySlug.get(s);
      if (found) {
        categoryId = found;
        break;
      }
    }

    await prisma.autoNewsTopic.upsert({
      where: {
        name_scope: { name: spec.name, scope: spec.scope },
      },
      update: {},
      create: {
        name: spec.name,
        scope: spec.scope,
        query: spec.query,
        categoryId,
        priority: spec.priority,
        isActive: true,
      },
    });
  }

  await prisma.setting.upsert({
    where: { key: "autoNewsDefaultsSeeded" },
    update: { value: "v2" },
    create: { key: "autoNewsDefaultsSeeded", value: "v2" },
  });
}

/**
 * Resolves a category for a newly tracked city/region, optionally creating a child category.
 */
export async function resolveOrCreateCityCategory(
  cityName: string,
  explicitCategoryId?: string,
  autoCreateCategory = false
): Promise<string> {
  if (explicitCategoryId) {
    const exists = await prisma.category.findUnique({
      where: { id: explicitCategoryId },
      select: { id: true },
    });
    if (exists) return exists.id;
  }

  const baseSlug = slugify(cityName) || `city-${Date.now()}`;
  const matching = await prisma.category.findFirst({
    where: { OR: [{ slug: baseSlug }, { name: cityName.trim() }] },
    select: { id: true },
  });
  if (matching) return matching.id;

  if (autoCreateCategory) {
    const mp = await prisma.category.findUnique({
      where: { slug: "madhya-pradesh" },
      select: { id: true },
    });
    let candidate = baseSlug;
    let i = 1;
    while (await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      candidate = `${baseSlug}-${i++}`;
    }
    const created = await prisma.category.create({
      data: {
        name: cityName.trim(),
        slug: candidate,
        parentId: mp?.id ?? null,
        order: 20,
      },
    });
    return created.id;
  }

  const firstCat = await prisma.category.findFirst({ orderBy: { order: "asc" }, select: { id: true } });
  if (!firstCat) throw new Error("No categories exist yet. Create a category first.");
  return firstCat.id;
}
