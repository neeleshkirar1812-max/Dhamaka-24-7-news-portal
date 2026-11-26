import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  action: z.enum(["publish", "unpublish", "delete", "restore", "permanent_delete"]),
});

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { ids, action } = BulkSchema.parse(body);

    if (action === "publish") {
      const now = new Date();
      await prisma.article.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { status: "PUBLISHED", publishedAt: now },
      });
    } else if (action === "unpublish") {
      await prisma.article.updateMany({
        where: { id: { in: ids } },
        data: { status: "UNPUBLISHED" },
      });
    } else if (action === "delete") {
      await prisma.article.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date(), status: "UNPUBLISHED" },
      });
    } else if (action === "restore") {
      await prisma.article.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: null },
      });
    } else if (action === "permanent_delete") {
      await prisma.article.deleteMany({
        where: { id: { in: ids } },
      });
    }

    revalidatePath("/");
    return NextResponse.json({ ok: true, count: ids.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid bulk request" }, { status: 400 });
    }
    return NextResponse.json({ error: "Bulk action failed" }, { status: 500 });
  }
}
