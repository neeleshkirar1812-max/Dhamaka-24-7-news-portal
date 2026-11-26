/**
 * Server-side environment configuration with safe defaults.
 * Never import secrets from here into client components.
 */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? "",
  nextAuthUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@newsportal.in",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  adsenseClientId: process.env.ADSENSE_CLIENT_ID ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiModel: process.env.AI_MODEL || "claude-sonnet-5-5",
  aiDailyLimit: Math.max(1, Number.parseInt(process.env.AI_DAILY_LIMIT ?? "200", 10) || 200),
  storageProvider: (process.env.STORAGE_PROVIDER ?? "local") as "local" | "cloudinary" | "s3",
};
