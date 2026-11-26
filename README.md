# धमाका 24*7 (Dhamaka 24*7) — Bilingual Hindi/English News Portal & AI Newsroom CMS

A production-ready Hindi/English news website with a regional news layout, built with Next.js App Router, TypeScript, Tailwind CSS, Prisma ORM, NextAuth (single-admin), Tiptap, Recharts, and Anthropic Claude AI editorial assistance.

## Tech Stack
- **Framework:** Next.js App Router (TypeScript, Server Components, ISR)
- **Styling:** Tailwind CSS + `lucide-react` + `Noto Sans Devanagari` & `Inter`
- **Database:** Prisma ORM (SQLite for local dev, PostgreSQL for production)
- **Auth:** NextAuth (Credentials provider, JWT sessions, bcrypt, rate-limited login)
- **Editor:** Tiptap rich text editor + AI Rewrite/Tone/Grammar toolbar
- **AI:** Anthropic Claude API via `@anthropic-ai/sdk` (server-side only, structured JSON + Zod validation + daily usage limits)
- **Ads & Revenue:** Custom Banner Ads + Google AdSense slots, `IntersectionObserver` impression tracking, click tracking, CPM/CPC revenue calculator, Recharts analytics, CSV export, and `ads.txt`

---

## Quick Start (Local Development)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Generate a `NEXTAUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

3. **Generate Admin Password Hash:**
   ```bash
   node -e "console.log(require('bcryptjs').hashSync('YourStrongPassword', 10))"
   ```
   Paste the output into `ADMIN_PASSWORD_HASH` in `.env` and set `ADMIN_EMAIL`.
   *(If `ADMIN_PASSWORD_HASH` is left empty in dev, `npm run seed` defaults to `Admin@123456`.)*

4. **Set up AI Editorial Features (Free Google Gemini OR Paid Anthropic Claude):**
   - **Free Option (Recommended):** Get a free-tier API key from [Google AI Studio](https://aistudio.google.com/apikey) (no credit card needed) and set `GEMINI_API_KEY="AIza..."` in `.env` (`GEMINI_MODEL` defaults to `gemini-4-hydrogen`).
   - **Anthropic Option:** Get an API key from [https://console.anthropic.com/](https://console.anthropic.com/) and set `ANTHROPIC_API_KEY="sk-ant-..."` (`AI_MODEL` defaults to `claude-sonnet-5-5`).
   - Optionally customize `AI_DAILY_LIMIT` (defaults to `200`).
   - If neither key is set, AI buttons are gracefully disabled and the rest of the site runs normally.

5. **Run database migrations and seed sample data:**
   ```bash
   npx prisma migrate dev
   npm run seed
   ```
   This seeds MP city categories (Bhopal, Indore, Gwalior, Jabalpur, Ujjain, Sagar, Rewa, Ratlam), 20 sample Hindi articles, 7 ad placements, demo ads, and 7 days of sample ad stats.

6. **Start the development server:**
   ```bash
   npm run dev
   ```
   - Public site: `http://localhost:3000`
   - Admin login: `http://localhost:3000/admin/login`

---

## Key Routes

### Public & SEO
- `/` — Home page (Breaking ticker, Hero 1+4, Latest News + Load More, Trending sidebar, MP City blocks)
- `/category/[slug]` — Category & MP City news pages
- `/news/[slug]` — Article detail page (ISR, 30-second AI Summary Box, in-article ads, JSON-LD `NewsArticle`, OpenGraph/Twitter meta)
- `/search?q=...` — Search published articles
- `/sitemap.xml`, `/news-sitemap.xml` (last 48h), `/robots.txt`, `/rss.xml`, `/ads.txt`

### Admin Panel (`/admin`)
- `/admin/login` — Single-admin login (rate-limited: 5 attempts / 15 min per IP)
- `/admin` — Editorial & AI usage dashboard
- `/admin/articles` — Articles table, filters, bulk publish/unpublish/delete, **AI Draft from Notes**
- `/admin/articles/new` & `/admin/articles/[id]` — Tiptap + AI Toolbar, AI Headlines, AI SEO Pack, AI Category, AI Alt/Caption, AI 30s Summary, AI Ticker Line, AI HI↔EN Translation, 30s autosave
- `/admin/articles/trash` — Restore or permanently delete
- `/admin/categories`, `/admin/tags`, `/admin/ticker`, `/admin/media`
- `/admin/ads` — AdSense & Direct Ads, KPIs, Recharts trend, AI Revenue Insights, CSV export, `ads.txt`
- `/admin/settings` — Site SEO, AI toggle/daily limit, Change Password

---

## Production Deployment

### Option A: Render + Managed PostgreSQL (Blueprint)
This repository includes a ready-to-use `render.yaml` Blueprint and `scripts/prepare-db.mjs` which automatically switches Prisma from SQLite (local dev) to PostgreSQL (production) when `DATABASE_URL` is a `postgresql://` connection string.

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Dhamaka 24*7 news portal"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. In the [Render Dashboard](https://dashboard.render.com/), click **New + -> Blueprint** and connect your GitHub repository.
3. Render automatically provisions the PostgreSQL database (`dhamaka24x7-db`) and web service (`dhamaka24x7-news`), runs `npm run render-build` (`prepare-db` -> `prisma generate` -> `prisma db push` -> `seed` -> `build`), and starts the server.
4. Set the prompted env vars in Render:
   - `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL`: your `https://<service>.onrender.com` URL
   - `ADMIN_PASSWORD_HASH`: bcrypt hash generated locally
   - `ANTHROPIC_API_KEY`: optional, for AI editorial features

### Option B: Vercel + Neon / Supabase PostgreSQL
1. Set `DATABASE_URL` to your Neon or Supabase PostgreSQL connection string.
2. Run `node scripts/prepare-db.mjs && npx prisma db push && npm run seed`.
3. Configure all `.env` variables in Vercel Project Settings and deploy.
4. For production image uploads, swap `uploadImageFile()` in `src/lib/storage.ts` to Cloudinary or S3 and set `STORAGE_PROVIDER`.

### Option C: VPS with Docker
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```
Run behind Nginx/Caddy with HTTPS and a managed PostgreSQL instance.
