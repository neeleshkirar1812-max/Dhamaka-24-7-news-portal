import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runAutoNewsCycle } from "@/lib/auto-news/engine";
import { getAutoNewsConfig } from "@/lib/auto-news/topics";

let lastBackgroundAttemptMs = 0;

/**
 * Checks for scheduled DRAFT articles whose scheduledAt <= now and publishes them.
 * Also triggers lightweight background Auto-News sync when configured interval has elapsed.
 */
export async function publishScheduledArticles(): Promise<number> {
  const now = new Date();
  const due = await prisma.article.findMany({
    where: {
      status: "DRAFT",
      deletedAt: null,
      scheduledAt: { lte: now },
    },
    select: {
      id: true,
      slug: true,
      scheduledAt: true,
      category: { select: { slug: true } },
    },
  });

  for (const art of due) {
    await prisma.article.update({
      where: { id: art.id },
      data: {
        status: "PUBLISHED",
        publishedAt: art.scheduledAt ?? now,
      },
    });
    revalidatePath("/");
    revalidatePath(`/news/${art.slug}`);
    revalidatePath(`/category/${art.category.slug}`);
  }

  // Non-blocking fallback auto-news check for environments without external cron
  const nowMs = Date.now();
  if (nowMs - lastBackgroundAttemptMs > 5 * 60_000) {
    lastBackgroundAttemptMs = nowMs;
    void (async () => {
      try {
        const cfg = await getAutoNewsConfig();
        if (!cfg.enabled) return;
        const lastMs = cfg.lastRunAt ? new Date(cfg.lastRunAt).getTime() : 0;
        if (nowMs - lastMs >= cfg.intervalMinutes * 60_000) {
          await runAutoNewsCycle({ maxItems: 2, trigger: "scheduler" });
        }
      } catch {
        // Silent background safeguard
      }
    })();
  }

  return due.length;
}
