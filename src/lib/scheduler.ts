import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Checks for scheduled DRAFT articles whose scheduledAt <= now and publishes them.
 * Safe to invoke on-request as a lightweight alternative to an external cron.
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

  if (due.length === 0) return 0;

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

  return due.length;
}
