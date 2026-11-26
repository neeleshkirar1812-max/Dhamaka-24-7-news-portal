/**
 * Server-side environment configuration with safe defaults.
 * Never import secrets from here into client components.
 */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw) && raw.includes(".")) {
    return raw.replace(/\/$/, "");
  }
  const renderUrl = process.env.RENDER_EXTERNAL_URL?.trim();
  if (renderUrl && /^https?:\/\//i.test(renderUrl)) {
    return renderUrl.replace(/\/$/, "");
  }
  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
    if (raw.includes(".")) return `https://${raw.replace(/\/$/, "")}`;
    return `https://${raw}.onrender.com`;
  }
  return "http://localhost:3000";
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? "",
  nextAuthUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@newsportal.in",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  siteUrl: resolveSiteUrl(),
  adsenseClientId: process.env.ADSENSE_CLIENT_ID ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiModel: process.env.AI_MODEL || "claude-sonnet-5-5",
  aiDailyLimit: Math.max(1, Number.parseInt(process.env.AI_DAILY_LIMIT ?? "200", 10) || 200),
  storageProvider: (process.env.STORAGE_PROVIDER ?? "local") as "local" | "cloudinary" | "s3",
};
