import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { applicationsRouter } from "./modules/applications/applications.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { boardRouter } from "./modules/board/board.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";
import { filesRouter } from "./modules/documents/files.routes.js";
import { interviewsRouter } from "./modules/interviews/interviews.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export const app = express();

app.set("trust proxy", env.TRUST_PROXY);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
if (env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    res.on("finish", () => console.log(`${req.method} ${req.originalUrl} → ${res.statusCode}`));
    next();
  });
}

const api = express.Router();
// Authenticated, per-user data: never let a browser or a CDN (Vercel caches proxied responses that
// allow it) store API responses. The file route sets its own "private" header.
api.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
api.get("/health", async (req, res) => {
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "down";
  }
  res.status(db === "ok" ? 200 : 503).json({ status: db === "ok" ? "ok" : "degraded", db });
});
api.use("/auth", authRouter);
api.use("/users", usersRouter);
api.use("/applications", applicationsRouter);
api.use("/board", boardRouter);
api.use("/interviews", interviewsRouter);
api.use("/documents", documentsRouter);
api.use("/dashboard", dashboardRouter);
api.use("/files", filesRouter); // signed download links (local storage)

app.use("/api/v1", api);
app.use(notFoundHandler);
app.use(errorHandler);
