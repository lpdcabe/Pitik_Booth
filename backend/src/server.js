import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import routes from "./routes/photobooths.js";
import { supabase } from "./services/supabase.js";
export const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:", "blob:"],
        "media-src": ["'self'", "blob:"],
        "script-src": ["'self'"],
        "connect-src": [
          "'self'",
          process.env.FRONTEND_URL || "http://localhost:5173",
        ],
        "style-src": ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    allowedHeaders: ["Content-Type", "X-Session-Id"],
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.get("/api/health", (req, res) =>
  res.json({ ok: true, storageConfigured: !!supabase }),
);
app.use("/api/photobooths", routes);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);
const dist = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}
app.use((error, req, res, next) => {
  console.error(error.message);
  const status =
    error.code === "LIMIT_FILE_SIZE"
      ? 413
      : error.status || (error.name === "MulterError" ? 400 : 500);
  res.status(status >= 400 && status < 500 ? status : 500).json({
    error:
      error.code === "LIMIT_FILE_SIZE"
        ? "Please choose an image smaller than 10 MB."
        : error.name === "MulterError"
          ? "Invalid upload."
          : error.status
            ? error.message
            : "Unable to complete this request. Please try again.",
  });
});
if (process.env.NODE_ENV !== "test")
  app.listen(process.env.PORT || 5000, () =>
    console.log(`Photobooth API listening on ${process.env.PORT || 5000}`),
  );
