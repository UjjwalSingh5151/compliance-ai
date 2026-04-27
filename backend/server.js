import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

// ─── Compliance AI (existing) ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are ComplianceAI, an expert Indian tax and GST compliance assistant. You help CAs, accountants, and business owners with:

- GST: GSTR-1, GSTR-3B, GSTR-2B reconciliation, ITC eligibility, reverse charge, e-invoicing, e-way bills, annual returns (GSTR-9/9C)
- Income Tax: TDS rates and sections (192, 194C, 194J, etc.), advance tax, ITR filing, Form 26AS/AIS, intimations u/s 143(1), scrutiny assessments
- Compliance deadlines and penalties
- Notices: GST show cause notices (DRC-01, ASMT-10), IT department notices, how to draft responses
- ITC: eligibility under Section 16, blocked credits u/s 17(5), reversal requirements, GSTR-2B vs purchase register mismatches

When reconciliation data is provided, analyze it concretely — name specific vendors, amounts, and risk items.

Rules:
- Always cite the relevant section/rule number when giving legal guidance
- Mention applicable penalties and interest rates where relevant
- For notices, always state the response deadline
- Keep responses concise but complete; use bullet points for action items
- Acknowledge when something requires professional CA advice for complex cases
- Use Indian numbering conventions (lakhs, crores) and ₹ symbol`;

app.post("/api/agent", async (req, res) => {
  const { message, history = [], reconContext } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const systemContent = reconContext
      ? `${SYSTEM_PROMPT}\n\n---\n${reconContext}`
      : SYSTEM_PROMPT;

    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemContent,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Claude API error:", err);
    const msg =
      err?.status === 401
        ? "Invalid API key. Set ANTHROPIC_API_KEY in backend/.env"
        : err?.message || "Unknown error";
    res.write(`data: ${JSON.stringify({ delta: `\n\n⚠️ Error: ${msg}` })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ─── EduGrade: Student Analyzer ──────────────────────────────────────────────

const ADMIN_USER_ID = "7f3cd39a-ec15-4053-9c6a-0afad38d2f46";

function fileToClaudeContent(file) {
  const isPDF = file.mimetype === "application/pdf";
  if (isPDF) {
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: file.buffer.toString("base64"),
      },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: file.mimetype,
      data: file.buffer.toString("base64"),
    },
  };
}

async function uploadToStorage(bucket, path, buffer, contentType) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

async function getRequestUser(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !supabaseAdmin) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user || null;
  } catch { return null; }
}

async function getUserSchool(userId, userEmail = null) {
  if (!supabaseAdmin || !userId) return null;

  // 1. Check if owner of a school
  const { data: owned } = await supabaseAdmin
    .from("schools").select("*").eq("owner_user_id", userId).maybeSingle();
  if (owned) return { school: owned, role: "owner" };

  // 2. Check if accepted member
  const { data: member } = await supabaseAdmin
    .from("school_members").select("*, schools(*)").eq("user_id", userId).eq("status", "accepted").maybeSingle();
  if (member?.schools) return { school: member.schools, role: member.role };

  // 3. Auto-accept pending invite by email
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

async function requireSchool(req, res, next) {
  const user = await getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const info = await getUserSchool(user.id, user.email);
  if (!info) return res.status(403).json({ error: "no_school" });
  if (info.school.status !== "approved") return res.status(403).json({ error: "school_pending" });
  req.user = user; req.school = info.school; req.schoolRole = info.role;
  next();
}

async function requireAdmin(req, res, next) {
  const user = await getRequestUser(req);
  if (!user || user.id !== ADMIN_USER_ID) return res.status(403).json({ error: "Admin only" });
  req.user = user; next();
}

const LENIENCY_PROMPTS = {
  1: "Be VERY STRICT. Award full marks only for perfectly correct answers with proper terminology, complete working, and no errors whatsoever.",
  2: "Be STRICT. Minor errors in presentation or terminology should result in mark deductions. Expect complete and well-structured answers.",
  3: "Be BALANCED. Award marks for correct concepts even if presentation isn't perfect. Small calculation errors may lose 1 mark but not more.",
  4: "Be LENIENT. Award marks generously if the student demonstrates understanding, even with minor errors or incomplete steps.",
  5: "Be VERY LENIENT. Give maximum benefit of doubt. Award marks for any reasonable attempt that shows partial understanding.",
};

// ─── School Management ────────────────────────────────────────────────────────

app.get("/api/school/me", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const info = await getUserSchool(user.id, user.email);
    if (!info) return res.json({ status: "none" });
    return res.json({ status: info.school.status, school: info.school, role: info.role, isAdmin: user.id === ADMIN_USER_ID });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/school", async (req, res) => {
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

app.get("/api/school/members", requireSchool, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("school_members").select("*").eq("school_id", req.school.id).order("created_at");
    if (error) throw error;
    res.json({ members: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/school/members/invite", requireSchool, async (req, res) => {
  try {
    if (req.schoolRole !== "owner") return res.status(403).json({ error: "Only school owner can invite" });
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: "Email required" });
    const cleanEmail = email.trim().toLowerCase();

    // Save invite record
    const { data, error } = await supabaseAdmin
      .from("school_members")
      .upsert({ school_id: req.school.id, invited_email: cleanEmail, role: "teacher", status: "pending" },
        { onConflict: "school_id,invited_email" })
      .select().single();
    if (error) throw error;

    // Send invite email via Supabase (creates account if needed, sends magic link)
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
      data: { invited_by_school: req.school.name },
    });
    if (inviteErr) console.warn("Invite email failed:", inviteErr.message);

    res.json({ member: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/school/members/:id", requireSchool, async (req, res) => {
  try {
    if (req.schoolRole !== "owner") return res.status(403).json({ error: "Only owner can remove members" });
    const { error } = await supabaseAdmin
      .from("school_members").delete().eq("id", req.params.id).eq("school_id", req.school.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Admin ────────────────────────────────────────────────────────────────────

app.get("/api/admin/schools", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("schools").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ schools: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/admin/schools/:id", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const { data, error } = await supabaseAdmin
      .from("schools").update({ status }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ school: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Student CRM ──────────────────────────────────────────────────────────────

app.get("/api/school/students", requireSchool, async (req, res) => {
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

app.patch("/api/school/students/:id", requireSchool, async (req, res) => {
  try {
    const allowed = ["email", "name", "roll_no", "class", "academic_year", "section"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabaseAdmin
      .from("analyzer_students").update(updates).eq("id", req.params.id).eq("school_id", req.school.id).select().single();
    if (error) throw error;
    res.json({ student: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/school/students/import — frontend parses Excel, sends JSON rows
app.post("/api/school/students/import", requireSchool, async (req, res) => {
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

      // Check for existing match
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

// ─── Tests ────────────────────────────────────────────────────────────────────

// POST /api/analyzer/tests — create test + optionally extract question paper
app.post("/api/analyzer/tests", upload.single("questionPaper"), async (req, res) => {
  try {
    const { name, subject, totalMarks = 100, leniency = 3, instructions = "" } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Test name is required" });

    let questionPaperUrl = null;
    let questionPaperContent = null;

    if (req.file) {
      const contentBlock = fileToClaudeContent(req.file);
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: "Extract and transcribe the complete question paper text. Include all questions with their marks allocations and any instructions. Preserve the question numbering and structure clearly.",
            },
          ],
        }],
      });
      questionPaperContent = response.content[0].text;

      questionPaperUrl = await uploadToStorage(
        "question-papers",
        `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`,
        req.file.buffer,
        req.file.mimetype
      );
    }

    if (!supabaseAdmin) {
      return res.json({ test: { id: `local-${Date.now()}`, name, subject, total_marks: parseInt(totalMarks), leniency: parseInt(leniency), instructions, question_paper_content: questionPaperContent } });
    }

    const user = await getRequestUser(req);
    const schoolInfo = user ? await getUserSchool(user.id, user.email) : null;
    const { data, error } = await supabaseAdmin
      .from("analyzer_tests")
      .insert({ name, subject, total_marks: parseInt(totalMarks), leniency: parseInt(leniency), instructions, question_paper_url: questionPaperUrl, question_paper_content: questionPaperContent, created_by: user?.id || null, school_id: schoolInfo?.school?.id || null })
      .select()
      .single();
    if (error) throw error;
    res.json({ test: data });
  } catch (err) {
    console.error("Create test error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyzer/tests
app.get("/api/analyzer/tests", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ tests: [] });
    const user = await getRequestUser(req);
    const schoolInfo = user ? await getUserSchool(user.id, user.email) : null;
    let query = supabaseAdmin
      .from("analyzer_tests")
      .select("*, analyzer_results(count)")
      .order("created_at", { ascending: false });
    if (schoolInfo?.school?.id) {
      if (schoolInfo.role === "teacher") {
        // Teachers only see their own tests
        query = query.eq("school_id", schoolInfo.school.id).eq("created_by", user.id);
      } else {
        // Owners see all school tests
        query = query.eq("school_id", schoolInfo.school.id);
      }
    } else if (user?.id) {
      query = query.eq("created_by", user.id);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ tests: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/analyzer/tests/:testId/analyze — bulk analyze answer sheets (SSE)
app.post("/api/analyzer/tests/:testId/analyze", upload.array("sheets", 50), async (req, res) => {
  const { testId } = req.params;
  const files = req.files || [];

  if (!files.length) return res.status(400).json({ error: "No files uploaded" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    let questionPaperContent = "";
    let totalMarks = 100;
    let leniency = 3;
    let instructions = "";

    if (supabaseAdmin) {
      const { data: test } = await supabaseAdmin
        .from("analyzer_tests")
        .select("question_paper_content, total_marks, leniency, instructions")
        .eq("id", testId)
        .single();
      if (test) {
        questionPaperContent = test.question_paper_content || "";
        totalMarks = test.total_marks || 100;
        leniency = test.leniency || 3;
        instructions = test.instructions || "";
      }
    }

    const leniencyInstruction = LENIENCY_PROMPTS[leniency] || LENIENCY_PROMPTS[3];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      send({ type: "progress", index: i, total: files.length, filename: file.originalname, status: "analyzing" });

      try {
        const contentBlock = fileToClaudeContent(file);

        const analyzePrompt = `You are an expert teacher carefully analyzing a student's handwritten answer sheet.

${questionPaperContent ? `QUESTION PAPER:\n${questionPaperContent}\n` : "No question paper provided — evaluate answers based on content visible in the sheet."}
TOTAL MARKS: ${totalMarks}

GRADING STRICTNESS: ${leniencyInstruction}
${instructions ? `\nSPECIAL INSTRUCTIONS FROM TEACHER:\n${instructions}\n` : ""}

Your task:
1. Extract the student's profile from the first page or header (roll number, name, class/grade, section, subject, academic year).
2. For EACH question: read the student's answer carefully, then evaluate it against the expected correct answer.
3. Provide your reasoning BEFORE awarding marks — explain what is correct, what is missing or wrong, and why you are giving those marks.
4. Identify specific improvement areas and strengths based on the overall performance.

Respond ONLY with valid JSON (no markdown fences, no explanation outside JSON) in this exact format:
{
  "student": {
    "roll_no": "roll number as written",
    "name": "full name as written",
    "class": "class or grade e.g. 10 or X",
    "section": "section if visible",
    "subject": "subject name",
    "academic_year": "academic year e.g. 2024-25 or 2025, extract from sheet header if visible, else null"
  },
  "questions": [
    {
      "no": 1,
      "student_answer": "Transcribe or clearly summarize exactly what the student has written for this question. Be detailed.",
      "expected_answer": "What the correct answer should be based on the question paper",
      "reasoning": "Step-by-step reasoning: what the student got right, what is wrong or missing, and how the marks were calculated based on the strictness level",
      "marks_awarded": 8,
      "marks_available": 10,
      "feedback": "Specific, actionable feedback written directly to the student on how to improve this answer",
      "is_correct": false
    }
  ],
  "marks_obtained": 75,
  "total_marks": ${totalMarks},
  "improvement_areas": ["specific topic or skill needing improvement", "another area"],
  "strengths": ["what the student did well", "another strength"],
  "overall_feedback": "2-3 sentence honest overall assessment of performance and what to focus on next"
}`;

        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 6000,
          messages: [{
            role: "user",
            content: [contentBlock, { type: "text", text: analyzePrompt }],
          }],
        });

        let analysis;
        try {
          const text = response.content[0].text;
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          analysis = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        } catch {
          analysis = { parse_error: true, raw: response.content[0].text, marks_obtained: 0, total_marks: totalMarks };
        }

        const student = analysis.student || {};
        let studentId = null;
        let sheetUrl = null;
        let resultId = null;
        let shareToken = null;

        if (supabaseAdmin) {
          // Upload original answer sheet
          const ext = file.originalname.split(".").pop();
          sheetUrl = await uploadToStorage(
            "answer-sheets",
            `${testId}/${student.roll_no || `student-${i}`}-${Date.now()}.${ext}`,
            file.buffer,
            file.mimetype
          );

          // Get school_id from test
          const { data: testRow } = await supabaseAdmin
            .from("analyzer_tests").select("school_id").eq("id", testId).single();
          const schoolId = testRow?.school_id || null;

          // Upsert student — school-scoped by roll + class + academic_year
          if (student.roll_no) {
            let q = supabaseAdmin.from("analyzer_students").select("id, email")
              .eq("roll_no", student.roll_no);
            if (schoolId) q = q.eq("school_id", schoolId);
            if (student.class) q = q.eq("class", student.class);
            if (student.academic_year) q = q.eq("academic_year", student.academic_year);
            const { data: existing } = await q.maybeSingle();

            if (existing) {
              await supabaseAdmin.from("analyzer_students")
                .update({ name: student.name, section: student.section })
                .eq("id", existing.id);
              studentId = existing.id;
            } else {
              const { data: ns } = await supabaseAdmin.from("analyzer_students")
                .insert({ roll_no: student.roll_no, name: student.name, class: student.class, section: student.section, academic_year: student.academic_year || null, school_id: schoolId })
                .select("id").single();
              studentId = ns?.id;
            }
          }

          // Save result
          const { data: result } = await supabaseAdmin.from("analyzer_results")
            .insert({
              test_id: testId,
              student_id: studentId,
              original_sheet_url: sheetUrl,
              analysis,
              marks_obtained: analysis.marks_obtained || 0,
              total_marks: analysis.total_marks || totalMarks,
            })
            .select("id, share_token")
            .single();
          resultId = result?.id;
          shareToken = result?.share_token;
        }

        send({ type: "result", index: i, filename: file.originalname, analysis, resultId, shareToken });
      } catch (fileErr) {
        console.error(`Error analyzing ${file.originalname}:`, fileErr);
        send({ type: "error", index: i, filename: file.originalname, error: fileErr.message });
      }
    }

    send({ type: "done" });
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Analyze batch error:", err);
    send({ type: "fatal", error: err.message });
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// GET /api/analyzer/students — students who have results in school's tests
app.get("/api/analyzer/students", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ students: [] });
    const user = await getRequestUser(req);
    const schoolInfo = user ? await getUserSchool(user.id, user.email) : null;
    const schoolId = schoolInfo?.school?.id;

    if (schoolInfo?.role === "teacher") {
      // Teachers only see students from their own tests
      const { data: testRows } = await supabaseAdmin
        .from("analyzer_tests").select("id").eq("created_by", user.id).eq("school_id", schoolId);
      const testIds = (testRows || []).map((t) => t.id);
      if (!testIds.length) return res.json({ students: [] });
      const { data: resultRows } = await supabaseAdmin
        .from("analyzer_results").select("student_id").in("test_id", testIds);
      const studentIds = [...new Set((resultRows || []).map((r) => r.student_id).filter(Boolean))];
      if (!studentIds.length) return res.json({ students: [] });
      const { data, error } = await supabaseAdmin
        .from("analyzer_students").select("*, analyzer_results(count)").in("id", studentIds).order("name");
      if (error) throw error;
      return res.json({ students: data || [] });
    }

    let query = supabaseAdmin.from("analyzer_students")
      .select("*, analyzer_results(count)").order("name");
    if (schoolId) query = query.eq("school_id", schoolId);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ students: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyzer/students/:id
app.get("/api/analyzer/students/:id", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ student: null, results: [] });
    const user = await getRequestUser(req);
    const schoolInfo = user ? await getUserSchool(user.id, user.email) : null;
    const schoolId = schoolInfo?.school?.id;

    const [{ data: student }, { data: results }] = await Promise.all([
      supabaseAdmin.from("analyzer_students").select("*").eq("id", req.params.id).single(),
      supabaseAdmin.from("analyzer_results")
        .select("id, test_id, marks_obtained, total_marks, share_token, analyzed_at, analyzer_tests(id, name, subject)")
        .eq("student_id", req.params.id)
        .order("analyzed_at", { ascending: false }),
    ]);

    // Filter results to this school's tests
    const filtered = schoolId
      ? (results || []).filter((r) => r.analyzer_tests)
      : results || [];

    res.json({ student, results: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyzer/results/:id
app.get("/api/analyzer/results/:id", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ result: null });
    const { data, error } = await supabaseAdmin
      .from("analyzer_results")
      .select("*, analyzer_tests(name, subject, total_marks, created_by), analyzer_students(name, roll_no, class, section)")
      .eq("id", req.params.id)
      .single();
    if (error) throw error;
    // Verify ownership
    const user = await getRequestUser(req);
    if (user && data?.analyzer_tests?.created_by && data.analyzer_tests.created_by !== user.id) {
      return res.status(403).json({ error: "Not authorised" });
    }
    res.json({ result: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/analyzer/results/:id/comments — save teacher comments per question
app.patch("/api/analyzer/results/:id/comments", async (req, res) => {
  try {
    const { comments } = req.body; // { "1": "comment for Q1", "2": "comment for Q2" }
    if (!supabaseAdmin) return res.json({ ok: true });
    const { error } = await supabaseAdmin
      .from("analyzer_results")
      .update({ teacher_comments: comments })
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyzer/share/:token — public, no auth required
app.get("/api/analyzer/share/:token", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ result: null });
    const { data, error } = await supabaseAdmin
      .from("analyzer_results")
      .select("*, analyzer_tests(name, subject, total_marks), analyzer_students(name, roll_no, class, section)")
      .eq("share_token", req.params.token)
      .single();
    if (error) throw error;
    res.json({ result: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Student Portal ──────────────────────────────────────────────────────────

async function getStudentByEmail(email) {
  if (!supabaseAdmin || !email) return null;
  const { data } = await supabaseAdmin
    .from("analyzer_students").select("*, schools(name, status)")
    .eq("email", email.toLowerCase()).maybeSingle();
  return data || null;
}

// GET /api/student/me
app.get("/api/student/me", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(404).json({ error: "not_a_student" });
    res.json({ student });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/student/results
app.get("/api/student/results", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(403).json({ error: "not_a_student" });
    const { data, error } = await supabaseAdmin
      .from("analyzer_results")
      .select("id, marks_obtained, total_marks, analyzed_at, share_token, revision_notes, analyzer_tests(name, subject)")
      .eq("student_id", student.id)
      .order("analyzed_at", { ascending: false });
    if (error) throw error;
    res.json({ student, results: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/student/results/:id
app.get("/api/student/results/:id", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(403).json({ error: "not_a_student" });
    const { data, error } = await supabaseAdmin
      .from("analyzer_results")
      .select("*, analyzer_tests(name, subject, total_marks), analyzer_students(name, roll_no, class, section)")
      .eq("id", req.params.id).eq("student_id", student.id).single();
    if (error) throw error;
    const { data: practiceSet } = await supabaseAdmin
      .from("practice_sets").select("id, questions, created_at")
      .eq("result_id", req.params.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    res.json({ result: data, practiceSet: practiceSet || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/student/results/:id/revision-notes
app.post("/api/student/results/:id/revision-notes", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(403).json({ error: "not_a_student" });
    const { data: result } = await supabaseAdmin
      .from("analyzer_results")
      .select("*, analyzer_tests(name, subject), analyzer_students(name)")
      .eq("id", req.params.id).eq("student_id", student.id).single();
    if (!result) return res.status(404).json({ error: "Result not found" });
    if (result.revision_notes) return res.json({ notes: result.revision_notes });

    const analysis = result.analysis || {};
    const prompt = `You are a helpful tutor creating personalized revision notes for a student.

Student: ${result.analyzer_students?.name || "Student"}
Test: ${result.analyzer_tests?.name || "Test"} (${result.analyzer_tests?.subject || ""})
Score: ${result.marks_obtained}/${result.total_marks}

Weak areas: ${(analysis.improvement_areas || []).join(", ")}

Question mistakes:
${(analysis.questions || []).filter(q => q.marks_awarded < q.marks_available)
  .map(q => `Q${q.no}: Got ${q.marks_awarded}/${q.marks_available}. ${q.reasoning || q.feedback || ""}`).join("\n")}

Create concise revision notes that:
1. Explain each concept they got wrong with a clear example
2. Give 2-3 memory tips per weak area
3. End with an encouraging summary

Write directly to the student using "you". Use clear headings. Be specific, not generic.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const notes = response.content[0].text;
    await supabaseAdmin.from("analyzer_results").update({ revision_notes: notes }).eq("id", req.params.id);
    res.json({ notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/student/results/:id/practice-questions
app.post("/api/student/results/:id/practice-questions", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user?.email) return res.status(401).json({ error: "Unauthorized" });
    const student = await getStudentByEmail(user.email);
    if (!student) return res.status(403).json({ error: "not_a_student" });
    const { data: result } = await supabaseAdmin
      .from("analyzer_results")
      .select("*, analyzer_tests(name, subject, question_paper_content), analyzer_students(name)")
      .eq("id", req.params.id).eq("student_id", student.id).single();
    if (!result) return res.status(404).json({ error: "Result not found" });

    const { refresh } = req.body;
    if (!refresh) {
      const { data: existing } = await supabaseAdmin
        .from("practice_sets").select("id, questions")
        .eq("result_id", req.params.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) return res.json({ practiceSetId: existing.id, questions: existing.questions });
    }

    const analysis = result.analysis || {};
    const wrongQs = (analysis.questions || []).filter(q => q.marks_awarded < q.marks_available);
    const prompt = `You are creating 8 multiple choice practice questions for a student based on their exam mistakes.

Subject: ${result.analyzer_tests?.subject || "General"}
Weak areas: ${(analysis.improvement_areas || []).join(", ")}
Questions they got wrong:
${wrongQs.map(q => `Q${q.no}: Student wrote "${q.student_answer || ""}", correct was "${q.expected_answer || ""}"`).join("\n")}

Generate exactly 8 MCQ questions targeting these specific weak concepts.
Respond ONLY with valid JSON:
{
  "questions": [
    {
      "no": 1,
      "question": "Clear question text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": "A",
      "explanation": "Why this is correct in 1-2 sentences"
    }
  ]
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    let questions;
    try {
      const match = response.content[0].text.match(/\{[\s\S]*\}/);
      questions = JSON.parse(match ? match[0] : response.content[0].text).questions;
    } catch { return res.status(500).json({ error: "Failed to parse questions" }); }

    const { data: practiceSet } = await supabaseAdmin
      .from("practice_sets").insert({ result_id: req.params.id, student_id: student.id, questions }).select("id").single();
    res.json({ practiceSetId: practiceSet.id, questions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/student/practice/:id/attempt
app.post("/api/student/practice/:id/attempt", async (req, res) => {
  try {
    const user = await getRequestUser(req);
    const { answers } = req.body;
    const { data: practiceSet } = await supabaseAdmin
      .from("practice_sets").select("questions").eq("id", req.params.id).single();
    if (!practiceSet) return res.status(404).json({ error: "Not found" });
    const questions = practiceSet.questions;
    let score = 0;
    const results = questions.map(q => {
      const answer = (answers || []).find(a => a.no === q.no);
      const correct = answer?.selected === q.correct;
      if (correct) score++;
      return { no: q.no, selected: answer?.selected || null, correct, correctAnswer: q.correct, explanation: q.explanation };
    });
    await supabaseAdmin.from("practice_attempts").insert({
      practice_set_id: req.params.id, student_user_id: user?.id || null,
      answers, score, total: questions.length, completed_at: new Date().toISOString(),
    });
    res.json({ score, total: questions.length, results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Static frontend ─────────────────────────────────────────────────────────

const frontendDist = path.join(__dirname, "../student-analyzer/dist");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
