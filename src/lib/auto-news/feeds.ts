import net from "node:net";
import { stripHtml } from "@/lib/sanitize";

export interface FeedItem {
  title: string;
  link: string;
  publisher: string;
  summary: string;
  publishedAt?: Date;
}

export interface FeedCluster {
  primary: FeedItem;
  supporting: FeedItem[];
}

const PRIVATE_HOSTNAME_RE = /^(localhost|.*\.local|.*\.internal)$/i;

/**
 * Validates that a custom RSS or source URL targets a public http/https host (SSRF protection).
 */
export function isSafePublicHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (!host || PRIVATE_HOSTNAME_RE.test(host)) return false;

    const ipVersion = net.isIP(host);
    if (ipVersion === 4) {
      const [a, b] = host.split(".").map(Number);
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      ) {
        return false;
      }
    } else if (ipVersion === 6) {
      if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
        return false;
      }
    } else if (!host.includes(".")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function decodeXmlEntities(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const decoded = withoutCdata
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return stripHtml(decoded);
}

function extractTag(block: string, tagName: string): string {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const m = block.match(re);
  return m ? decodeXmlEntities(m[1]) : "";
}

function extractAtomLink(block: string): string {
  const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (hrefMatch?.[1]) return hrefMatch[1].trim();
  return extractTag(block, "link");
}

function cleanHeadline(rawTitle: string): { title: string; inferredPublisher?: string } {
  // Google News appends " - Publisher Name" to headlines
  const idx = rawTitle.lastIndexOf(" - ");
  if (idx > 20 && idx < rawTitle.length - 3) {
    return {
      title: rawTitle.slice(0, idx).trim(),
      inferredPublisher: rawTitle.slice(idx + 3).trim(),
    };
  }
  return { title: rawTitle.trim() };
}

/**
 * Parses standard RSS 2.0 or Atom XML feeds cleanly without external XML dependencies.
 */
export function parseRssOrAtomXml(xml: string, fallbackPublisher = "News Feed"): FeedItem[] {
  const items: FeedItem[] = [];
  const itemMatches = xml.match(/<(?:item|entry)\b[^>]*>[\s\S]*?<\/(?:item|entry)>/gi) ?? [];

  for (const block of itemMatches.slice(0, 25)) {
    const rawTitle = extractTag(block, "title");
    const link = extractAtomLink(block);
    if (!rawTitle || !link || !isSafePublicHttpUrl(link)) continue;

    const { title, inferredPublisher } = cleanHeadline(rawTitle);
    if (title.length < 10) continue;

    const publisher =
      extractTag(block, "source") ||
      extractTag(block, "dc:creator") ||
      inferredPublisher ||
      fallbackPublisher;

    const rawDesc =
      extractTag(block, "description") || extractTag(block, "summary") || title;
    const rawDate = extractTag(block, "pubDate") || extractTag(block, "updated") || extractTag(block, "published");
    const parsedDate = rawDate ? new Date(rawDate) : undefined;
    const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;

    items.push({
      title,
      link,
      publisher: publisher.slice(0, 100),
      summary: rawDesc.slice(0, 600),
      publishedAt,
    });
  }

  return items;
}

/**
 * Builds curated Hindi + English fallback RSS URLs for a scope & region/city.
 */
export function buildFeedUrlsForTopic(topic: {
  scope: string;
  name: string;
  query: string;
  rssUrl?: string | null;
}): string[] {
  const urls: string[] = [];

  if (topic.rssUrl && isSafePublicHttpUrl(topic.rssUrl)) {
    urls.push(topic.rssUrl.trim());
  }

  const q = topic.query.trim() || topic.name.trim();

  if (topic.scope === "GLOBAL") {
    urls.push("https://news.google.com/rss/headlines/section/TOPIC/WORLD?hl=hi&gl=IN&ceid=IN:hi");
    urls.push("https://feeds.bbci.co.uk/news/world/rss.xml");
  } else if (topic.scope === "NATIONAL") {
    urls.push("https://news.google.com/rss/headlines/section/TOPIC/NATION?hl=hi&gl=IN&ceid=IN:hi");
    urls.push("https://pib.gov.in/RssMain.aspx?ModId=6&Lang=2&Regid=3");
  } else {
    // STATE or CITY: search Hindi news + English India regional fallback
    urls.push(
      `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:3d`)}&hl=hi&gl=IN&ceid=IN:hi`
    );
    urls.push(
      `https://news.google.com/rss/search?q=${encodeURIComponent(`${topic.name} Madhya Pradesh news when:4d`)}&hl=en-IN&gl=IN&ceid=IN:en`
    );
  }

  return Array.from(new Set(urls));
}

export function normalizeTextTokens(text: string): Set<string> {
  const stopWords = new Set([
    "news",
    "latest",
    "today",
    "live",
    "updates",
    "hindi",
    "india",
    "madhya",
    "pradesh",
    "की",
    "के",
    "में",
    "है",
    "और",
    "से",
    "को",
    "पर",
    "ने",
    "का",
    "एक",
    "ताजा",
    "खबर",
    "समाचार",
  ]);
  const clean = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));
  return new Set(clean);
}

export function tokenOverlapSimilarity(a: string, b: string): number {
  const ta = normalizeTextTokens(a);
  const tb = normalizeTextTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const w of ta) {
    if (tb.has(w)) shared += 1;
  }
  const denom = Math.min(ta.size, tb.size);
  return denom > 0 ? shared / denom : 0;
}

async function fetchSingleFeed(url: string): Promise<FeedItem[]> {
  if (!isSafePublicHttpUrl(url)) return [];
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Dhamaka24x7Bot/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const host = new URL(url).hostname;
    return parseRssOrAtomXml(xml, host);
  } catch {
    return [];
  }
}

/**
 * Fetches live feeds for a topic and clusters multi-publisher reports on the same story.
 */
export async function fetchClusteredNewsForTopic(topic: {
  scope: string;
  name: string;
  query: string;
  rssUrl?: string | null;
}): Promise<FeedCluster[]> {
  const feedUrls = buildFeedUrlsForTopic(topic);
  const results = await Promise.all(feedUrls.map((u) => fetchSingleFeed(u)));

  const cutoffMs = Date.now() - 96 * 60 * 60 * 1000; // last 4 days max
  const flat: FeedItem[] = [];
  const seenUrls = new Set<string>();

  for (const list of results) {
    for (const item of list) {
      if (item.publishedAt && item.publishedAt.getTime() < cutoffMs) continue;
      const key = item.link.split("?")[0];
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
      flat.push(item);
    }
  }

  flat.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));

  const clusters: FeedCluster[] = [];
  for (const item of flat) {
    const existing = clusters.find((c) => tokenOverlapSimilarity(c.primary.title, item.title) >= 0.35);
    if (existing) {
      if (
        existing.supporting.length < 4 &&
        existing.primary.publisher.toLowerCase() !== item.publisher.toLowerCase()
      ) {
        existing.supporting.push(item);
      }
    } else {
      clusters.push({ primary: item, supporting: [] });
    }
  }

  // Prefer stories corroborated by multiple publishers first, then most recent
  clusters.sort((a, b) => {
    if (b.supporting.length !== a.supporting.length) {
      return b.supporting.length - a.supporting.length;
    }
    return (b.primary.publishedAt?.getTime() ?? 0) - (a.primary.publishedAt?.getTime() ?? 0);
  });

  return clusters;
}
