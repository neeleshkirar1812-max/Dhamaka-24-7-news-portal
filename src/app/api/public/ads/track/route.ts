import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const TrackSchema = z.object({
  placementId: z.string().min(1),
  adId: z.string().nullable().optional(),
  event: z.enum(["impression", "click"]),
});

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const rate = checkRateLimit(`adtrack:${ip}`, 120, 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { placementId, adId, event } = TrackSchema.parse(body);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (adId) {
      await prisma.adStat.upsert({
        where: {
          adId_placementId_date: { adId, placementId, date: today },
        },
        update:
          event === "impression"
            ? { impressions: { increment: 1 } }
            : { clicks: { increment: 1 } },
        create: {
          adId,
          placementId,
          date: today,
          impressions: event === "impression" ? 1 : 0,
          clicks: event === "click" ? 1 : 0,
        },
      });
    } else {
      const existing = await prisma.adStat.findFirst({
        where: { adId: null, placementId, date: today },
      });
      if (existing) {
        await prisma.adStat.update({
          where: { id: existing.id },
          data:
            event === "impression"
              ? { impressions: { increment: 1 } }
              : { clicks: { increment: 1 } },
        });
      } else {
        await prisma.adStat.create({
          data: {
            adId: null,
            placementId,
            date: today,
            impressions: event === "impression" ? 1 : 0,
            clicks: event === "click" ? 1 : 0,
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
