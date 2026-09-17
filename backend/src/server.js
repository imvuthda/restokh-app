import http from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { checkDatabase, pool } from "./config/database.js";
import { env, validateEnvironment } from "./config/env.js";
import { verifyAccessToken } from "./utils/jwt.js";
validateEnvironment();
await checkDatabase();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.frontendUrls, credentials: true },
});
app.set("io", io);
io.use((socket, next) => {
  try {
    socket.user = verifyAccessToken(socket.handshake.auth?.token);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});
io.on("connection", (socket) => {
  if (socket.user.branchId) socket.join(`branch:${socket.user.branchId}`);
  socket.on("branch:join", (branchId) => {
    if (socket.user.role === "super_admin" && Number(branchId) > 0)
      socket.join(`branch:${Number(branchId)}`);
  });
});
server.listen(env.port, "0.0.0.0", () =>
  console.log(`Restaurant API running on port ${env.port}`),
);
const shutdown = (signal) => {
  console.log(`${signal}: shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
