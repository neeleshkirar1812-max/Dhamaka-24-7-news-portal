import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export interface UploadResult {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Storage abstraction layer.
 * Currently implements local `/public/uploads` storage for dev,
 * with clean extension points for Cloudinary or S3 in production.
 */
export async function uploadImageFile(file: File, alt?: string): Promise<UploadResult> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, and WebP images are allowed.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 5 MB limit.");
  }

  const ext = EXT_BY_MIME[file.type] ?? ".jpg";
  const randomName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let publicUrl: string;

  if (env.storageProvider === "local") {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, randomName), buffer);
    publicUrl = `/uploads/${randomName}`;
  } else {
    // Placeholder for S3 / Cloudinary SDK integration
    throw new Error(`Storage provider "${env.storageProvider}" is not configured yet.`);
  }

  const media = await prisma.media.create({
    data: {
      filename: randomName,
      url: publicUrl,
      alt: alt || null,
      mimeType: file.type,
      size: file.size,
    },
  });

  return {
    id: media.id,
    url: media.url,
    filename: media.filename,
    mimeType: media.mimeType,
    size: media.size,
  };
}

export async function deleteStoredFile(mediaId: string): Promise<void> {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) return;

  if (env.storageProvider === "local" && media.url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", media.url);
    await fs.unlink(filePath).catch(() => {});
  }
  await prisma.media.delete({ where: { id: mediaId } });
}
