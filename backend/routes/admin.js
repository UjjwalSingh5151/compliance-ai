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

// ─── Usage metrics dashboard ──────────────────────────────────────────────────
// GET /admin/metrics — high-level usage stats for the admin interview dashboard
router.get("/metrics", requireAdmin, async (req, res) => {
  try {
    // Total papers evaluated all time
    const { count: totalPapers } = await supabaseAdmin
      .from("analyzer_results").select("*", { count: "exact", head: true });

    // Papers this month
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { count: papersThisMonth } = await supabaseAdmin
      .from("analyzer_results")
      .select("*", { count: "exact", head: true })
      .gte("analyzed_at", monthStart.toISOString());

    // Papers last month (for MoM growth)
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const { count: papersLastMonth } = await supabaseAdmin
      .from("analyzer_results")
      .select("*", { count: "exact", head: true })
      .gte("analyzed_at", prevMonthStart.toISOString())
      .lt("analyzed_at", monthStart.toISOString());

    // Active schools (have at least one result)
    const { data: activeSchoolRows } = await supabaseAdmin
      .from("analyzer_results")
      .select("analyzer_tests(school_id)");
    const activeSchoolIds = new Set(
      (activeSchoolRows || []).map((r) => r.analyzer_tests?.school_id).filter(Boolean)
    );

    // All approved schools
    const { count: approvedSchools } = await supabaseAdmin
      .from("schools").select("*", { count: "exact", head: true }).eq("status", "approved");

    // Per-school paper counts
    const { data: allResults } = await supabaseAdmin
      .from("analyzer_results")
      .select("analyzed_at, analyzer_tests(school_id, schools(id, name))");

    const perSchool = {};
    for (const r of allResults || []) {
      const school = r.analyzer_tests?.schools;
      if (!school) continue;
      if (!perSchool[school.id]) perSchool[school.id] = { id: school.id, name: school.name, total: 0, thisMonth: 0 };
      perSchool[school.id].total++;
      if (r.analyzed_at >= monthStart.toISOString()) perSchool[school.id].thisMonth++;
    }

    const momGrowth = papersLastMonth > 0
      ? Math.round(((papersThisMonth - papersLastMonth) / papersLastMonth) * 100)
      : papersThisMonth > 0 ? 100 : 0;

    res.json({
      totalPapers: totalPapers || 0,
      papersThisMonth: papersThisMonth || 0,
      papersLastMonth: papersLastMonth || 0,
      momGrowth,
      approvedSchools: approvedSchools || 0,
      activeSchools: activeSchoolIds.size,
      perSchool: Object.values(perSchool).sort((a, b) => b.total - a.total),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Accuracy benchmark report ────────────────────────────────────────────────
// GET /admin/benchmark — AI vs teacher agreement across all tests with overrides
router.get("/benchmark", requireAdmin, async (req, res) => {
  try {
    // Get results that have at least one teacher_override in analysis.questions
    const { data: results } = await supabaseAdmin
      .from("analyzer_results")
      .select("id, marks_obtained, total_marks, analysis, analyzer_tests(name, subject, class, school_id, schools(name))")
      .order("analyzed_at", { ascending: false });

    // For each result, calculate AI vs teacher marks
    // AI marks = sum of ai_marks_awarded from override_log entries for that result
    // We use override_log to find what was overridden
    const { data: overrides } = await supabaseAdmin
      .from("override_log")
      .select("result_id, question_no, ai_marks_awarded, override_marks, subject, class");

    // Group overrides by result
    const overrideMap = {};
    for (const ov of overrides || []) {
      if (!overrideMap[ov.result_id]) overrideMap[ov.result_id] = [];
      overrideMap[ov.result_id].push(ov);
    }

    // Build benchmark per test
    const testMap = {};
    for (const r of results || []) {
      const resultOverrides = overrideMap[r.id] || [];
      if (!resultOverrides.length) continue; // skip results with no overrides

      const testName = r.analyzer_tests?.name || "Unknown";
      const subject = r.analyzer_tests?.subject || "Unknown";
      const cls = r.analyzer_tests?.class || "Unknown";
      const schoolName = r.analyzer_tests?.schools?.name || "Unknown";
      const key = `${r.analyzer_tests?.school_id || ""}:${subject}:${cls}`;

      if (!testMap[key]) testMap[key] = {
        subject, class: cls, schoolName,
        papers: 0, aiCorrect: 0, totalOverrides: 0, totalAgreement: 0,
      };

      testMap[key].papers++;
      let thisResultAgreement = 0;
      for (const ov of resultOverrides) {
        testMap[key].totalOverrides++;
        const diff = Math.abs((ov.ai_marks_awarded || 0) - (ov.override_marks || 0));
        const threshold = 0.5; // within 0.5 marks = agreement
        if (diff <= threshold) { testMap[key].aiCorrect++; thisResultAgreement++; }
      }
    }

    const benchmarkRows = Object.values(testMap).map((row) => ({
      ...row,
      agreementPct: row.totalOverrides > 0
        ? Math.round((row.aiCorrect / row.totalOverrides) * 100)
        : null,
    })).sort((a, b) => (b.agreementPct || 0) - (a.agreementPct || 0));

    const overallAgreement = benchmarkRows.length > 0
      ? Math.round(
          benchmarkRows.filter((r) => r.agreementPct !== null)
            .reduce((s, r) => s + r.agreementPct, 0) /
          benchmarkRows.filter((r) => r.agreementPct !== null).length
        )
      : null;

    res.json({
      benchmarkRows,
      overallAgreement,
      totalOverrides: (overrides || []).length,
      note: benchmarkRows.length === 0
        ? "No teacher overrides recorded yet. Benchmark becomes available once teachers start correcting AI marks."
        : null,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
