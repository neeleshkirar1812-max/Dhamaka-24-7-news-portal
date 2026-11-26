import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const ViewSchema = z.object({
  articleId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { articleId } = ViewSchema.parse(body);

    const ip = getClientIp(req.headers);
    // Debounce views per IP + articleId for 10 minutes
    const rate = checkRateLimit(`view:${ip}:${articleId}`, 1, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ ok: true, debounced: true });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.$transaction([
      prisma.article.update({
        where: { id: articleId },
        data: { views: { increment: 1 } },
      }),
      prisma.articleView.upsert({
        where: { articleId_date: { articleId, date: today } },
        update: { count: { increment: 1 } },
        create: { articleId, date: today, count: 1 },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
