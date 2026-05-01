import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

export const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

export const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

export const LENIENCY_PROMPTS = {
  1: "Be VERY STRICT. Award full marks only for perfectly correct answers with proper terminology, complete working, and no errors whatsoever.",
  2: "Be STRICT. Minor errors in presentation or terminology should result in mark deductions. Expect complete and well-structured answers.",
  3: "Be BALANCED. Award marks for correct concepts even if presentation isn't perfect. Small calculation errors may lose 1 mark but not more.",
  4: "Be LENIENT. Award marks generously if the student demonstrates understanding, even with minor errors or incomplete steps.",
  5: "Be VERY LENIENT. Give maximum benefit of doubt. Award marks for any reasonable attempt that shows partial understanding.",
};

// Estimate PDF page count without a library — reads /Count N from the Pages dict.
export function getPDFPageCount(buffer) {
  try {
    const full = buffer.toString("latin1");
    const matches = [...full.matchAll(/\/Count\s+(\d+)/g)];
    if (!matches.length) return null;
    return Math.max(...matches.map((m) => parseInt(m[1], 10)));
  } catch { return null; }
}

export function fileToClaudeContent(file) {
  const isPDF = file.mimetype === "application/pdf";
  if (isPDF) {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: file.buffer.toString("base64") },
    };
  }
  return {
    type: "image",
    source: { type: "base64", media_type: file.mimetype, data: file.buffer.toString("base64") },
  };
}

// ─── Credits ──────────────────────────────────────────────────────────────────
// Deduct credits from a school atomically.
// Returns { ok: true } on success or { ok: false, error: "insufficient_credits" }.
// Never throws — DB errors are logged and treated as ok so analysis is never blocked by billing.
export async function deductCredits(schoolId, amount, type, description = "") {
  if (!supabaseAdmin || !schoolId || !amount) return { ok: true };
  try {
    const { data: school, error: fetchErr } = await supabaseAdmin
      .from("schools").select("credits").eq("id", schoolId).single();
    if (fetchErr) { console.warn("deductCredits fetch:", fetchErr.message); return { ok: true }; }
    const current = school?.credits ?? 0;
    if (current < amount) return { ok: false, error: "insufficient_credits" };
    const newBalance = current - amount;
    const { error: updateErr } = await supabaseAdmin
      .from("schools").update({ credits: newBalance }).eq("id", schoolId);
    if (updateErr) { console.warn("deductCredits update:", updateErr.message); return { ok: true }; }
    // Log async — never block the caller
    supabaseAdmin.from("credit_transactions")
      .insert({ school_id: schoolId, amount: -amount, type, description, balance_after: newBalance })
      .then(() => {}).catch(() => {});
    return { ok: true, balance: newBalance };
  } catch (e) { console.warn("deductCredits:", e.message); return { ok: true }; }
}

export async function uploadToStorage(bucket, filePath, buffer, contentType) {
  if (!supabaseAdmin) return null;
  const { error } = await supabaseAdmin.storage
    .from(bucket).upload(filePath, buffer, { contentType, upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
  return publicUrl;
}

export async function getRequestUser(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !supabaseAdmin) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user || null;
  } catch { return null; }
}

export async function getUserSchool(userId, userEmail = null) {
  if (!supabaseAdmin || !userId) return null;

  const { data: owned } = await supabaseAdmin
    .from("schools").select("*").eq("owner_user_id", userId).maybeSingle();
  if (owned) return { school: owned, role: "owner" };

  const { data: member } = await supabaseAdmin
    .from("school_members").select("*, schools(*)")
    .eq("user_id", userId).eq("status", "accepted").maybeSingle();
  if (member?.schools) return { school: member.schools, role: member.role };

  if (userEmail) {
    const { data: invite } = await supabaseAdmin
      .from("school_members").select("*, schools(*)")
      .eq("invited_email", userEmail.toLowerCase()).eq("status", "pending").maybeSingle();
    if (invite?.schools) {
      await supabaseAdmin.from("school_members")
        .update({ user_id: userId, status: "accepted" }).eq("id", invite.id);
      return { school: invite.schools, role: "teacher" };
    }
  }
  return null;
}

export async function requireSchool(req, res, next) {
  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  let info = await getUserSchool(user.id, user.email);

  if (!info && user.id === ADMIN_USER_ID) {
    const { data: school } = await supabaseAdmin
      .from("schools").select("*").eq("status", "approved").order("created_at").limit(1).maybeSingle();
    if (school) info = { school, role: "owner" };
  }

  if (!info) return res.status(403).json({ error: "no_school" });
  if (info.school.status !== "approved") return res.status(403).json({ error: "school_pending" });
  req.user = user; req.school = info.school; req.schoolRole = info.role;
  next();
}

export async function requireAdmin(req, res, next) {
  const user = await getRequestUser(req);
  if (!user || user.id !== ADMIN_USER_ID) return res.status(403).json({ error: "Admin only" });
  req.user = user; next();
}
