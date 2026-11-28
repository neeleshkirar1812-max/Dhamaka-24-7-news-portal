import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { aiFactCheckAndWriteNews, generateEditorialImage, getAiStatus } from "@/lib/ai";
import { uploadImageBuffer } from "@/lib/storage";
import { slugify } from "@/lib/slugify";
import {
  fetchClusteredNewsForTopic,
  isSafePublicHttpUrl,
  tokenOverlapSimilarity,
  type FeedCluster,
} from "./feeds";
import { ensureDefaultAutoNewsTopics, getAutoNewsConfig } from "./topics";

export interface AutoNewsRunOptions {
  topicId?: string;
  maxItems?: number;
  force?: boolean;
  trigger?: "admin" | "cron" | "scheduler";
}

export interface AutoNewsRunItemResult {
  topicName: string;
  scope: string;
  headline: string;
  verification: string;
  confidence: number;
  outcome: string;
  articleId?: string;
  articleSlug?: string;
  reason?: string;
}

export interface AutoNewsRunSummary {
  ok: boolean;
  skippedReason?: string;
  processed: number;
  published: number;
  drafts: number;
  rejected: number;
  duplicatesSkipped: number;
  results: AutoNewsRunItemResult[];
}

async function acquireLock(): Promise<boolean> {
  const now = Date.now();
  const row = await prisma.setting.findUnique({ where: { key: "autoNewsLockUntil" } });
  const existingUntil = row ? Number.parseInt(row.value, 10) || 0 : 0;
  if (existingUntil > now) return false;

  await prisma.setting.upsert({
    where: { key: "autoNewsLockUntil" },
    update: { value: String(now + 120_000) },
    create: { key: "autoNewsLockUntil", value: String(now + 120_000) },
  });
  return true;
}

async function releaseLock(): Promise<void> {
  await prisma.setting
    .upsert({
      where: { key: "autoNewsLockUntil" },
      update: { value: "0" },
      create: { key: "autoNewsLockUntil", value: "0" },
    })
    .catch(() => {});
}

async function ensureUniqueArticleSlug(baseSlug: string): Promise<string> {
  const cleaned = baseSlug.slice(0, 90) || `news-${Date.now()}`;
  let candidate = cleaned;
  let counter = 1;
  while (await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${cleaned}-${counter}`;
    counter += 1;
  }
  return candidate;
}

async function loadExistingFingerprints() {
  const [recentArticles, recentLogs] = await Promise.all([
    prisma.article.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: { title: true, sourceUrls: true },
    }),
    prisma.autoNewsLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      select: { headline: true, sourcesJson: true },
    }),
  ]);

  const seenUrls = new Set<string>();
  const seenTitles: string[] = [];

  for (const a of recentArticles) {
    seenTitles.push(a.title);
    if (a.sourceUrls) {
      try {
        const parsed = JSON.parse(a.sourceUrls) as Array<{ url?: string }>;
        for (const s of parsed) {
          if (s.url) seenUrls.add(s.url.split("?")[0]);
        }
      } catch {
        // ignore invalid json
      }
    }
  }

  for (const l of recentLogs) {
    seenTitles.push(l.headline);
    if (l.sourcesJson) {
      try {
        const parsed = JSON.parse(l.sourcesJson) as Array<{ url?: string }>;
        for (const s of parsed) {
          if (s.url) seenUrls.add(s.url.split("?")[0]);
        }
      } catch {
        // ignore invalid json
      }
    }
  }

  return { seenUrls, seenTitles };
}

function isDuplicateCluster(
  cluster: FeedCluster,
  seenUrls: Set<string>,
  seenTitles: string[]
): boolean {
  const primaryUrlKey = cluster.primary.link.split("?")[0];
  if (seenUrls.has(primaryUrlKey)) return true;

  for (const title of seenTitles) {
    if (tokenOverlapSimilarity(cluster.primary.title, title) >= 0.52) {
      return true;
    }
  }
  return false;
}

/**
 * Runs one end-to-end AI discovery, multi-source fact-checking, drafting, and publishing cycle.
 */
export async function runAutoNewsCycle(
  options: AutoNewsRunOptions = {}
): Promise<AutoNewsRunSummary> {
  await ensureDefaultAutoNewsTopics();
  const [config, aiStatus] = await Promise.all([getAutoNewsConfig(), getAiStatus()]);

  if (!options.force && !config.enabled) {
    return {
      ok: true,
      skippedReason: "Auto News engine is paused in settings.",
      processed: 0,
      published: 0,
      drafts: 0,
      rejected: 0,
      duplicatesSkipped: 0,
      results: [],
    };
  }

  if (!aiStatus.enabled || aiStatus.limitReached) {
    return {
      ok: false,
      skippedReason: !aiStatus.configured
        ? "AI API key missing in Settings."
        : !aiStatus.enabled
          ? "AI assistant is disabled."
          : `Daily AI limit (${aiStatus.dailyLimit}) reached.`,
      processed: 0,
      published: 0,
      drafts: 0,
      rejected: 0,
      duplicatesSkipped: 0,
      results: [],
    };
  }

  const locked = await acquireLock();
  if (!locked) {
    return {
      ok: true,
      skippedReason: "Another Auto News scan is currently running.",
      processed: 0,
      published: 0,
      drafts: 0,
      rejected: 0,
      duplicatesSkipped: 0,
      results: [],
    };
  }

  const summary: AutoNewsRunSummary = {
    ok: true,
    processed: 0,
    published: 0,
    drafts: 0,
    rejected: 0,
    duplicatesSkipped: 0,
    results: [],
  };

  try {
    const targetLimit = Math.min(8, Math.max(1, options.maxItems ?? config.maxPerRun));

    const topics = options.topicId
      ? await prisma.autoNewsTopic.findMany({
          where: { id: options.topicId },
          include: { category: { select: { id: true, name: true, slug: true } } },
        })
      : await prisma.autoNewsTopic.findMany({
          where: { isActive: true },
          orderBy: [{ lastRunAt: "asc" }, { priority: "desc" }],
          include: { category: { select: { id: true, name: true, slug: true } } },
        });

    if (topics.length === 0) {
      summary.skippedReason = "No active topics/cities selected.";
      return summary;
    }

    const { seenUrls, seenTitles } = await loadExistingFingerprints();

    for (const topic of topics) {
      if (summary.processed >= targetLimit) break;

      const clusters = await fetchClusteredNewsForTopic(topic);
      await prisma.autoNewsTopic.update({
        where: { id: topic.id },
        data: { lastRunAt: new Date() },
      });

      if (clusters.length === 0) continue;

      let topicHandled = 0;
      const perTopicCap = options.topicId ? targetLimit : 1;

      for (const cluster of clusters) {
        if (summary.processed >= targetLimit || topicHandled >= perTopicCap) break;

        if (isDuplicateCluster(cluster, seenUrls, seenTitles)) {
          summary.duplicatesSkipped += 1;
          continue;
        }

        // Reserve title & url in memory so same cycle never picks overlap
        seenUrls.add(cluster.primary.link.split("?")[0]);
        seenTitles.push(cluster.primary.title);

        summary.processed += 1;
        topicHandled += 1;

        try {
          const verified = await aiFactCheckAndWriteNews({
            scope: topic.scope,
            regionName: topic.name,
            primaryHeadline: cluster.primary.title,
            primarySummary: cluster.primary.summary,
            primaryUrl: cluster.primary.link,
            primaryPublisher: cluster.primary.publisher,
            publishedAt: cluster.primary.publishedAt?.toISOString(),
            relatedReports: cluster.supporting.map((s) => ({
              publisher: s.publisher,
              title: s.title,
              summary: s.summary,
              url: s.link,
            })),
          });

          // Combine verified AI sources + discovered cluster URLs cleanly
          const combinedSources = new Map<string, { publisher: string; title: string; url: string }>();
          for (const s of verified.verifiedSources) {
            if (isSafePublicHttpUrl(s.url)) {
              combinedSources.set(s.url, s);
            }
          }
          if (isSafePublicHttpUrl(cluster.primary.link)) {
            combinedSources.set(cluster.primary.link, {
              publisher: cluster.primary.publisher,
              title: cluster.primary.title,
              url: cluster.primary.link,
            });
          }
          for (const sup of cluster.supporting) {
            if (isSafePublicHttpUrl(sup.link)) {
              combinedSources.set(sup.link, {
                publisher: sup.publisher,
                title: sup.title,
                url: sup.link,
              });
            }
          }
          const sourcesList = Array.from(combinedSources.values()).slice(0, 6);
          const sourcesJson = JSON.stringify(sourcesList);

          // Check duplicate against generated Hindi title as well
          const duplicateHindiTitle = seenTitles.some(
            (t) => t !== cluster.primary.title && tokenOverlapSimilarity(verified.title, t) >= 0.65
          );
          if (duplicateHindiTitle) {
            summary.duplicatesSkipped += 1;
            await prisma.autoNewsLog.create({
              data: {
                topicId: topic.id,
                headline: verified.title,
                scope: topic.scope,
                cityOrRegion: topic.name,
                verification: "DUPLICATE",
                confidence: verified.confidence,
                outcome: "SKIPPED",
                reason: "Matched recently published Hindi article title.",
                sourcesJson,
              },
            });
            summary.results.push({
              topicName: topic.name,
              scope: topic.scope,
              headline: verified.title,
              verification: "DUPLICATE",
              confidence: verified.confidence,
              outcome: "SKIPPED",
              reason: "Duplicate headline skipped",
            });
            continue;
          }

          // Fact-check rejection gate for DISPUTED/fake stories
          if (verified.verification === "DISPUTED" || verified.confidence < 40) {
            summary.rejected += 1;
            await prisma.autoNewsLog.create({
              data: {
                topicId: topic.id,
                headline: verified.title || cluster.primary.title,
                scope: topic.scope,
                cityOrRegion: topic.name,
                verification: "DISPUTED",
                confidence: verified.confidence,
                outcome: "REJECTED",
                reason: verified.factCheckNotes,
                sourcesJson,
              },
            });
            summary.results.push({
              topicName: topic.name,
              scope: topic.scope,
              headline: verified.title || cluster.primary.title,
              verification: "DISPUTED",
              confidence: verified.confidence,
              outcome: "REJECTED",
              reason: verified.factCheckNotes,
            });
            continue;
          }

          const shouldPublish =
            config.autoPublish &&
            verified.verification === "VERIFIED" &&
            verified.confidence >= config.minScore;

          const status = shouldPublish ? "PUBLISHED" : "DRAFT";

          let featuredImageUrl: string | null = null;
          if (config.generateImage && verified.imagePrompt) {
            const generatedImg = await generateEditorialImage(verified.imagePrompt);
            if (generatedImg) {
              try {
                const uploaded = await uploadImageBuffer(
                  generatedImg.buffer,
                  generatedImg.mimeType,
                  verified.title
                );
                featuredImageUrl = uploaded.url;
              } catch {
                featuredImageUrl = null;
              }
            }
          }

          const uniqueSlug = await ensureUniqueArticleSlug(verified.slug);

          // Resolve tags safely
          const tagConnects: { tagId: string }[] = [];
          for (const rawTag of verified.tags.slice(0, 6)) {
            const name = rawTag.trim();
            if (!name) continue;
            const tagSlug = slugify(name) || `tag-${Date.now()}`;
            const tag = await prisma.tag.upsert({
              where: { slug: tagSlug },
              update: {},
              create: { name, slug: tagSlug },
            });
            tagConnects.push({ tagId: tag.id });
          }

          const createdArticle = await prisma.article.create({
            data: {
              title: verified.title,
              slug: uniqueSlug,
              subtitle: verified.subtitle || null,
              excerpt: verified.excerpt,
              content: verified.contentHtml,
              featuredImage: featuredImageUrl,
              imageAlt: featuredImageUrl ? verified.title : null,
              imageCaption: featuredImageUrl ? `${topic.name} — AI संपादकीय चित्र` : null,
              status,
              isBreaking: status === "PUBLISHED" ? Boolean(verified.isBreaking) : false,
              isFeatured: false,
              authorName: "धमाका 24*7 AI न्यूज़ डेस्क",
              categoryId: topic.categoryId,
              metaTitle: verified.metaTitle.slice(0, 100),
              metaDescription: verified.metaDescription.slice(0, 220),
              aiSummary: verified.aiSummaryText,
              aiAssisted: true,
              factCheckStatus: verified.verification,
              factCheckScore: verified.confidence,
              factCheckNotes: verified.factCheckNotes,
              sourceUrls: sourcesJson,
              publishedAt: status === "PUBLISHED" ? new Date() : null,
              tags: { create: tagConnects },
            },
          });

          seenTitles.push(createdArticle.title);

          if (status === "PUBLISHED") {
            summary.published += 1;
            revalidatePath("/");
            revalidatePath(`/news/${createdArticle.slug}`);
            revalidatePath(`/category/${topic.category.slug}`);
          } else {
            summary.drafts += 1;
          }

          await prisma.autoNewsLog.create({
            data: {
              topicId: topic.id,
              articleId: createdArticle.id,
              headline: createdArticle.title,
              scope: topic.scope,
              cityOrRegion: topic.name,
              verification: verified.verification,
              confidence: verified.confidence,
              outcome: status,
              reason: verified.factCheckNotes,
              sourcesJson,
            },
          });

          summary.results.push({
            topicName: topic.name,
            scope: topic.scope,
            headline: createdArticle.title,
            verification: verified.verification,
            confidence: verified.confidence,
            outcome: status,
            articleId: createdArticle.id,
            articleSlug: createdArticle.slug,
            reason: verified.factCheckNotes,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "AI verification error";
          await prisma.autoNewsLog.create({
            data: {
              topicId: topic.id,
              headline: cluster.primary.title,
              scope: topic.scope,
              cityOrRegion: topic.name,
              verification: "ERROR",
              confidence: 0,
              outcome: "ERROR",
              reason: msg.slice(0, 500),
            },
          });
          summary.results.push({
            topicName: topic.name,
            scope: topic.scope,
            headline: cluster.primary.title,
            verification: "ERROR",
            confidence: 0,
            outcome: "ERROR",
            reason: msg,
          });
        }
      }
    }

    await prisma.setting.upsert({
      where: { key: "autoNewsLastRunAt" },
      update: { value: new Date().toISOString() },
      create: { key: "autoNewsLastRunAt", value: new Date().toISOString() },
    });

    return summary;
  } finally {
    await releaseLock();
  }
}
