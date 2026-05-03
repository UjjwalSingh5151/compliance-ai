import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { supabaseAdmin, getRequestUser, ADMIN_USER_ID } from "./lib/shared.js";
import schoolRouter from "./routes/school.js";
import adminRouter from "./routes/admin.js";
import analyzerRouter from "./routes/analyzer.js";
import studentRouter from "./routes/student.js";
import papersRouter from "./routes/papers.js";
import analyticsRouter from "./routes/analytics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allowed origins: comma-separated list in CORS_ORIGINS env var.
// Always allows localhost (any port) and requests with no origin (mobile apps,
// Postman, curl). In production set:
//   CORS_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
// Strip trailing slashes so https://example.com/ and https://example.com both work
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // No origin = mobile app / Postman / curl — always allow
    if (!origin) return cb(null, true);
    // Localhost (any port) — always allow for dev
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    // *.onrender.com — allow Render preview URLs and same-server requests
    if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin)) return cb(null, true);
    // Explicitly allowed origins (from CORS_ORIGINS env var)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));

// ─── Request logger ───────────────────────────────────────────────────────────
// Logs: METHOD /path STATUS Xms  (SSE streams log when the connection closes)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const lvl = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";
    console.log(`[${lvl}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// ─── Health & Auth ────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.json({ isAdmin: false });
    res.json({ isAdmin: user.id === ADMIN_USER_ID });
  } catch { res.json({ isAdmin: false }); }
});

// ─── Route modules ────────────────────────────────────────────────────────────

app.use("/api/school",    schoolRouter);
app.use("/api/admin",     adminRouter);
app.use("/api/analyzer",  analyzerRouter);
app.use("/api/student",   studentRouter);
app.use("/api/papers",    papersRouter);
app.use("/api/analytics", analyticsRouter);

// ─── Static frontend (optional) ───────────────────────────────────────────────
// Set SERVE_FRONTEND=true on Render while the web app still lives here.
// Set SERVE_FRONTEND=false once the web app is deployed to Vercel — the
// backend then becomes a pure API server.
if (process.env.SERVE_FRONTEND === "true") {
  const frontendDist = path.join(__dirname, "../student-analyzer/dist");
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
  console.log("Serving frontend from", frontendDist);
} else {
  // Pure API mode — return 404 JSON for unknown routes instead of an HTML page
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`EduGrade API running on http://localhost:${PORT}`);
  console.log(`Frontend serving: ${process.env.SERVE_FRONTEND === "true" ? "ON" : "OFF (API only)"}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(", ") : "localhost only"}`);
});
