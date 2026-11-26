import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
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

interface CloudinaryCreds {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

async function getCloudinaryCreds(): Promise<CloudinaryCreds> {
  if (env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret) {
    return {
      cloudName: env.cloudinaryCloudName.trim(),
      apiKey: env.cloudinaryApiKey.trim(),
      apiSecret: env.cloudinaryApiSecret.trim(),
    };
  }

  const rows = await prisma.setting.findMany({
    where: {
      key: { in: ["cloudinaryCloudName", "cloudinaryApiKey", "cloudinaryApiSecret"] },
    },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value.trim()]));
  return {
    cloudName: env.cloudinaryCloudName.trim() || map.cloudinaryCloudName || "",
    apiKey: env.cloudinaryApiKey.trim() || map.cloudinaryApiKey || "",
    apiSecret: env.cloudinaryApiSecret.trim() || map.cloudinaryApiSecret || "",
  };
}

export async function getStorageStatus() {
  const creds = await getCloudinaryCreds();
  const cloudinaryConfigured = Boolean(creds.cloudName && creds.apiKey && creds.apiSecret);
  const activeProvider =
    env.storageProvider === "cloudinary" || cloudinaryConfigured
      ? "cloudinary"
      : env.storageProvider;
  return {
    provider: activeProvider,
    cloudinaryConfigured,
    cloudName: creds.cloudName || null,
  };
}

function signCloudinaryParams(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

async function uploadToCloudinary(
  buffer: Buffer,
  mimeType: string,
  publicIdBase: string,
  creds: CloudinaryCreds
): Promise<{ url: string; publicId: string }> {
  const folder = "dhamaka24x7";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signCloudinaryParams(
    { folder, public_id: publicIdBase, timestamp },
    creds.apiSecret
  );

  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const form = new FormData();
  form.append("file", dataUri);
  form.append("api_key", creds.apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("public_id", publicIdBase);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(creds.cloudName)}/image/upload`,
    { method: "POST", body: form }
  );
  const data = (await res.json()) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.secure_url || !data.public_id) {
    throw new Error(data.error?.message || "Cloudinary upload failed.");
  }

  return { url: data.secure_url, publicId: data.public_id };
}

async function deleteFromCloudinary(publicId: string, creds: CloudinaryCreds): Promise<void> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signCloudinaryParams({ public_id: publicId, timestamp }, creds.apiSecret);

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", creds.apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);

  await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(creds.cloudName)}/image/destroy`,
    { method: "POST", body: form }
  ).catch(() => {});
}

/**
 * Storage abstraction layer.
 * Uses Cloudinary automatically when Cloudinary credentials are configured (or
 * STORAGE_PROVIDER="cloudinary"), and falls back to local `/public/uploads` in dev.
 */
export async function uploadImageFile(file: File, alt?: string): Promise<UploadResult> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, and WebP images are allowed.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 5 MB limit.");
  }

  const ext = EXT_BY_MIME[file.type] ?? ".jpg";
  const baseId = `${Date.now()}-${crypto.randomUUID()}`;
  const randomName = `${baseId}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const creds = await getCloudinaryCreds();
  const cloudinaryReady = Boolean(creds.cloudName && creds.apiKey && creds.apiSecret);

  let publicUrl: string;
  let storedFilename = randomName;

  if (env.storageProvider === "cloudinary" || cloudinaryReady) {
    if (!cloudinaryReady) {
      throw new Error(
        "Cloudinary is selected, but CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET is missing."
      );
    }
    const uploaded = await uploadToCloudinary(buffer, file.type, baseId, creds);
    publicUrl = uploaded.url;
    storedFilename = uploaded.publicId;
  } else if (env.storageProvider === "local") {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, randomName), buffer);
    publicUrl = `/uploads/${randomName}`;
  } else {
    throw new Error(`Storage provider "${env.storageProvider}" is not configured yet.`);
  }

  const media = await prisma.media.create({
    data: {
      filename: storedFilename,
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

  if (media.url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", media.url);
    await fs.unlink(filePath).catch(() => {});
  } else if (media.url.includes("res.cloudinary.com") && media.filename) {
    const creds = await getCloudinaryCreds();
    if (creds.cloudName && creds.apiKey && creds.apiSecret) {
      await deleteFromCloudinary(media.filename, creds);
    }
  }
  await prisma.media.delete({ where: { id: mediaId } });
}
