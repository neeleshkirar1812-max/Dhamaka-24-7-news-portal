import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { runAutoNewsCycle } from "@/lib/auto-news/engine";

const RunSchema = z.object({
  topicId: z.string().optional(),
  maxItems: z.number().int().min(1).max(6).optional(),
});

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const data = RunSchema.parse(body);

    const summary = await runAutoNewsCycle({
      topicId: data.topicId,
      maxItems: data.maxItems,
      force: true,
      trigger: "admin",
    });

    if (!summary.ok) {
      return NextResponse.json(
        { error: summary.skippedReason || "Auto News scan failed", summary },
        { status: 400 }
      );
    }

    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run AI news scan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
