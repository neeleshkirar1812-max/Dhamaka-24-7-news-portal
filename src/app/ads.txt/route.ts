import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { key: "adsTxt" } });
  const content = setting?.value ?? "# ads.txt\n";
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
