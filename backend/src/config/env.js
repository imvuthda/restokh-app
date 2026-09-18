import "dotenv/config";

const requiredInProduction = [
  "DB_HOST",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
  "FRONTEND_URLS",
];

export function validateEnvironment() {
  if ((process.env.NODE_ENV || "development") !== "production") return;
  const missing = requiredInProduction.filter(
    (key) => !String(process.env[key] || "").trim(),
  );
  if (missing.length)
    throw new Error(`Missing production variables: ${missing.join(", ")}`);
  if (
    String(process.env.JWT_SECRET).length < 32 ||
    /change.?me/i.test(process.env.JWT_SECRET)
  ) {
    throw new Error(
      "JWT_SECRET must be a strong random value of at least 32 characters",
    );
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  jwtSecret: process.env.JWT_SECRET || "development-only-secret-change-me-now",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  frontendUrls: String(
    process.env.FRONTEND_URLS || "http://localhost:5173,http://127.0.0.1:5173",
  )
    .split(",")
    .map((v) => v.trim().replace(/\/$/, ""))
    .filter(Boolean),
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB || 5),
};
