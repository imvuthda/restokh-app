import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(root, "../../uploads");

const allowedPrefixes = ["/uploads/menu/", "/uploads/branding/"];

export function isManagedUploadUrl(value) {
  if (typeof value !== "string") return false;
  return allowedPrefixes.some((prefix) => value.startsWith(prefix));
}

export async function deleteManagedUpload(value) {
  if (!isManagedUploadUrl(value)) return false;

  const relative = value.replace(/^\/uploads\//, "");
  const filePath = path.resolve(uploadsRoot, relative);
  const relativeCheck = path.relative(uploadsRoot, filePath);

  // Never allow a path to escape backend/uploads.
  if (relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) return false;

  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    // Missing old files are harmless; do not make an otherwise valid update fail.
    if (error?.code === "ENOENT") return false;
    console.error(`Failed to delete old upload ${value}:`, error);
    return false;
  }
}
