import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";

export const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      branchId: user.branch_id,
      role: user.role_code,
      jti: crypto.randomUUID(),
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
export const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);
