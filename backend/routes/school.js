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

// ─── Teacher CRM ──────────────────────────────────────────────────────────────

router.get("/teachers", requireSchool, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("school_teachers").select("*").eq("school_id", req.school.id).order("name");
    if (error) throw error;
    res.json({ teachers: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /teachers/me — current teacher's own CRM record, matched by auth email
router.get("/teachers/me", requireSchool, async (req, res) => {
  try {
    const email = req.user.email?.toLowerCase();
    if (!email) return res.json({ teacher: null });
    const { data } = await supabaseAdmin
      .from("school_teachers")
      .select("*")
      .eq("school_id", req.school.id)
      .ilike("email", email)
      .maybeSingle();
    res.json({ teacher: data || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /teachers/me — teacher updates their own CRM record
router.patch("/teachers/me", requireSchool, async (req, res) => {
  try {
    const email = req.user.email?.toLowerCase();
    if (!email) return res.status(400).json({ error: "No email on account" });

    // Find the teacher record for this user
    const { data: existing } = await supabaseAdmin
      .from("school_teachers")
      .select("id")
      .eq("school_id", req.school.id)
      .ilike("email", email)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: "No teacher record found for your email. Ask your admin to add your email to the teacher list." });

    // Only allow self-service fields — name, subjects, classes
    // Email is not editable (it's tied to auth); admin controls class/subject assignments via web portal
    const allowed = ["name", "subjects", "classes"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields to update" });

    const { data, error } = await supabaseAdmin
      .from("school_teachers")
      .update(updates)
      .eq("id", existing.id)
      .select().single();
    if (error) throw error;
    res.json({ teacher: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/teachers/import", requireSchool, async (req, res) => {
  try {
    const { teachers } = req.body;
    if (!Array.isArray(teachers) || !teachers.length) return res.status(400).json({ error: "No teachers provided" });
    let imported = 0, updated = 0;
    for (const t of teachers) {
      const name = t.name?.toString().trim();
      if (!name) continue;
      const email = t.email?.toString().trim().toLowerCase() || null;
      const classes = t.classes ? t.classes.toString().split(",").map((s) => s.trim()).filter(Boolean) : [];
      const subjects = t.subjects ? t.subjects.toString().split(",").map((s) => s.trim()).filter(Boolean) : [];
      const record = { school_id: req.school.id, name, email, classes, subjects };
      if (email) {
        const { data: existing } = await supabaseAdmin.from("school_teachers")
          .select("id").eq("school_id", req.school.id).eq("email", email).maybeSingle();
        if (existing) {
          await supabaseAdmin.from("school_teachers").update(record).eq("id", existing.id);
          updated++; continue;
        }
      }
      await supabaseAdmin.from("school_teachers").insert(record);
      imported++;
    }
    res.json({ imported, updated, total: teachers.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/teachers", requireSchool, async (req, res) => {
  try {
    const { name, email, classes = [], subjects = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    const record = {
      school_id: req.school.id,
      name: name.trim(),
      email: email?.trim().toLowerCase() || null,
      classes: Array.isArray(classes) ? classes.filter(Boolean) : [],
      subjects: Array.isArray(subjects) ? subjects.filter(Boolean) : [],
    };
    const { data, error } = await supabaseAdmin.from("school_teachers").insert(record).select().single();
    if (error) throw error;
    res.json({ teacher: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/teachers/:id", requireSchool, async (req, res) => {
  try {
    const allowed = ["name", "email", "classes", "subjects"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabaseAdmin
      .from("school_teachers").update(updates)
      .eq("id", req.params.id).eq("school_id", req.school.id).select().single();
    if (error) throw error;
    res.json({ teacher: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/teachers/:id", requireSchool, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("school_teachers").delete().eq("id", req.params.id).eq("school_id", req.school.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /teachers/:id/invite — send portal invite to a teacher by their stored email
router.post("/teachers/:id/invite", requireSchool, async (req, res) => {
  try {
    if (req.schoolRole !== "owner") return res.status(403).json({ error: "Only school owner can invite" });
    const { data: teacher, error: tErr } = await supabaseAdmin
      .from("school_teachers").select("*").eq("id", req.params.id).eq("school_id", req.school.id).single();
    if (tErr || !teacher) return res.status(404).json({ error: "Teacher not found" });
    if (!teacher.email) return res.status(400).json({ error: "Teacher has no email address — edit the teacher record and add an email first." });

    const cleanEmail = teacher.email.toLowerCase();
    const { data: member, error: mErr } = await supabaseAdmin
      .from("school_members")
      .upsert({ school_id: req.school.id, invited_email: cleanEmail, role: "teacher", status: "pending" },
        { onConflict: "school_id,invited_email" })
      .select().single();
    if (mErr) throw mErr;

    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
      data: { invited_by_school: req.school.name },
    });
    if (inviteErr) console.warn("Supabase invite email failed:", inviteErr.message);

    res.json({ ok: true, member });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /credits — current credit balance + recent transactions
router.get("/credits", requireSchool, async (req, res) => {
  try {
    const { data: school } = await supabaseAdmin
      .from("schools").select("credits").eq("id", req.school.id).single();
    const { data: transactions } = await supabaseAdmin
      .from("credit_transactions").select("*")
      .eq("school_id", req.school.id).order("created_at", { ascending: false }).limit(30);
    res.json({ credits: school?.credits ?? 0, transactions: transactions || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
