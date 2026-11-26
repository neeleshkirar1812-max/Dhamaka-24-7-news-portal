import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { uploadImageFile } from "@/lib/storage";

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const alt = formData.get("alt");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const uploaded = await uploadImageFile(
      file,
      typeof alt === "string" ? alt : undefined
    );
    return NextResponse.json(uploaded, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
