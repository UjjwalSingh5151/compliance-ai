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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ─── Health & Auth ────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => res.json({ ok: true }));

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

// ─── Static frontend ──────────────────────────────────────────────────────────

const frontendDist = path.join(__dirname, "../student-analyzer/dist");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`EduGrade server running on http://localhost:${PORT}`));
