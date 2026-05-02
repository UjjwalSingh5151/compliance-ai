import { Router } from "express";
import { supabaseAdmin, requireAdmin } from "../lib/shared.js";

const router = Router();

// ─── School management ────────────────────────────────────────────────────────

router.get("/schools", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("schools").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ schools: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/schools/:id", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const { data, error } = await supabaseAdmin
      .from("schools").update({ status }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ school: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Invite school ────────────────────────────────────────────────────────────
// Uses Supabase admin invite — sends a magic link that bypasses OTP expiry.
// The school owner clicks the link, lands on app.kelzo.ai, goes through
// SchoolSetup, and appears in the pending list for approval.

router.post("/invite-school", requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: "Email is required" });

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      { redirectTo: process.env.APP_URL || "https://app.kelzo.ai" }
    );
    if (error) throw error;
    res.json({ ok: true, email: data.user?.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Credits management ───────────────────────────────────────────────────────

// GET /admin/credits — all approved schools with credit balance + recent usage
router.get("/credits", requireAdmin, async (req, res) => {
  try {
    const { data: schools, error } = await supabaseAdmin
      .from("schools")
      .select("id, name, contact_email, status, credits")
      .order("name");
    if (error) throw error;

    // Fetch last 7-day usage per school
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: txns } = await supabaseAdmin
      .from("credit_transactions")
      .select("school_id, amount")
      .lt("amount", 0)                // only deductions
      .gte("created_at", since);

    const usageMap = {};
    for (const t of txns || []) {
      usageMap[t.school_id] = (usageMap[t.school_id] || 0) + Math.abs(t.amount);
    }

    res.json({
      schools: (schools || []).map((s) => ({
        ...s, usageLast7Days: usageMap[s.id] || 0,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /admin/schools/:id/credits — add (positive) or deduct (negative) credits
router.post("/schools/:id/credits", requireAdmin, async (req, res) => {
  try {
    const { amount, note = "Admin adjustment" } = req.body;
    const amt = parseInt(amount);
    if (!amt || isNaN(amt)) return res.status(400).json({ error: "amount must be a non-zero integer" });

    const { data: school, error: fetchErr } = await supabaseAdmin
      .from("schools").select("credits").eq("id", req.params.id).single();
    if (fetchErr || !school) return res.status(404).json({ error: "School not found" });

    const newBalance = (school.credits || 0) + amt;
    if (newBalance < 0) return res.status(400).json({ error: "Balance cannot go below 0" });

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("schools").update({ credits: newBalance }).eq("id", req.params.id).select().single();
    if (updateErr) throw updateErr;

    await supabaseAdmin.from("credit_transactions").insert({
      school_id: req.params.id,
      amount: amt,
      type: amt > 0 ? "admin_add" : "admin_deduct",
      description: note,
      balance_after: newBalance,
    });

    res.json({ school: updated, newBalance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /admin/schools/:id/credits/history — transaction log for one school
router.get("/schools/:id/credits/history", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("credit_transactions")
      .select("*")
      .eq("school_id", req.params.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ transactions: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
