import { Router } from "express";
import { supabaseAdmin, getRequestUser, getUserSchool, requireSchool, ADMIN_USER_ID } from "../lib/shared.js";

const router = Router();

router.get("/me", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const info = await getUserSchool(user.id, user.email);
    if (!info) return res.json({ status: "none" });
    return res.json({ status: info.school.status, school: info.school, role: info.role, isAdmin: user.id === ADMIN_USER_ID });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { name, contact_email } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "School name required" });
    const existing = await getUserSchool(user.id, user.email);
    if (existing) return res.status(400).json({ error: "Already have a school registered" });
    const { data, error } = await supabaseAdmin
      .from("schools").insert({ name: name.trim(), contact_email: contact_email?.trim() || null, owner_user_id: user.id })
      .select().single();
    if (error) throw error;
    res.json({ school: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/members", requireSchool, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("school_members").select("*").eq("school_id", req.school.id).order("created_at");
    if (error) throw error;
    res.json({ members: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/members/invite", requireSchool, async (req, res) => {
  try {
    if (req.schoolRole !== "owner") return res.status(403).json({ error: "Only school owner can invite" });
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: "Email required" });
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabaseAdmin
      .from("school_members")
      .upsert({ school_id: req.school.id, invited_email: cleanEmail, role: "teacher", status: "pending" },
        { onConflict: "school_id,invited_email" })
      .select().single();
    if (error) throw error;
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
      data: { invited_by_school: req.school.name },
    });
    if (inviteErr) console.warn("Invite email failed:", inviteErr.message);
    res.json({ member: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/members/:id", requireSchool, async (req, res) => {
  try {
    if (req.schoolRole !== "owner") return res.status(403).json({ error: "Only owner can remove members" });
    const { error } = await supabaseAdmin
      .from("school_members").delete().eq("id", req.params.id).eq("school_id", req.school.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Student CRM ──────────────────────────────────────────────────────────────

router.get("/students", requireSchool, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("analyzer_students")
      .select("*, analyzer_results(count)")
      .eq("school_id", req.school.id)
      .order("class").order("roll_no");
    if (error) throw error;
    res.json({ students: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/students/:id", requireSchool, async (req, res) => {
  try {
    const allowed = ["email", "name", "roll_no", "class", "academic_year", "section"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabaseAdmin
      .from("analyzer_students").update(updates)
      .eq("id", req.params.id).eq("school_id", req.school.id).select().single();
    if (error) throw error;
    res.json({ student: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/students/import", requireSchool, async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || !students.length) return res.status(400).json({ error: "No students provided" });
    let imported = 0, updated = 0;
    for (const s of students) {
      const roll_no = s.roll_no?.toString().trim();
      const cls = s.class?.toString().trim();
      const academic_year = s.academic_year?.toString().trim();
      if (!roll_no) continue;
      const record = {
        school_id: req.school.id,
        name: s.name?.trim() || null,
        roll_no,
        class: cls || null,
        academic_year: academic_year || null,
        email: s.email?.trim().toLowerCase() || null,
      };
      let query = supabaseAdmin.from("analyzer_students").select("id")
        .eq("school_id", req.school.id).eq("roll_no", roll_no);
      if (cls) query = query.eq("class", cls);
      if (academic_year) query = query.eq("academic_year", academic_year);
      const { data: existing } = await query.maybeSingle();
      if (existing) {
        await supabaseAdmin.from("analyzer_students").update(record).eq("id", existing.id);
        updated++;
      } else {
        await supabaseAdmin.from("analyzer_students").insert(record);
        imported++;
      }
    }
    res.json({ imported, updated, total: students.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/students", requireSchool, async (req, res) => {
  try {
    const { name, roll_no, class: cls, academic_year, email, section } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    const record = {
      school_id: req.school.id,
      name: name.trim(),
      roll_no: roll_no?.toString().trim() || null,
      class: cls?.toString().trim() || null,
      academic_year: academic_year?.toString().trim() || null,
      email: email?.trim().toLowerCase() || null,
      section: section?.toString().trim() || null,
    };
    const { data, error } = await supabaseAdmin.from("analyzer_students").insert(record).select().single();
    if (error) throw error;
    res.json({ student: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
