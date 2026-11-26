import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getAiStatus } from "@/lib/ai";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await getAiStatus();
  return NextResponse.json(status);
}
