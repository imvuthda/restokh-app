import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { ApiError } from "../utils/api-error.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const menuDirectory = path.resolve(root, "../../uploads/menu");
const brandingDirectory = path.resolve(root, "../../uploads/branding");
fs.mkdirSync(menuDirectory, { recursive: true });
fs.mkdirSync(brandingDirectory, { recursive: true });
const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const menuImageUpload = multer({
  storage: multer.diskStorage({
    destination: menuDirectory,
    filename: (_req, file, cb) =>
      cb(
        null,
        `${Date.now()}-${crypto.randomUUID()}${extensions[file.mimetype] || ""}`,
      ),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    extensions[file.mimetype]
      ? cb(null, true)
      : cb(new ApiError(422, "Only JPG, PNG or WebP images are allowed")),
});

export const brandLogoUpload = multer({
  storage: multer.diskStorage({
    destination: brandingDirectory,
    filename: (_req, file, cb) =>
      cb(
        null,
        `logo-${Date.now()}-${crypto.randomUUID()}${extensions[file.mimetype] || ""}`,
      ),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    extensions[file.mimetype]
      ? cb(null, true)
      : cb(new ApiError(422, "Only JPG, PNG or WebP images are allowed")),
});
