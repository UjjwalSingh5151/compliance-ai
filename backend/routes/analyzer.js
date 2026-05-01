import { Router } from "express";
import {
  supabaseAdmin, client, upload,
  LENIENCY_PROMPTS, fileToClaudeContent, uploadToStorage,
  getRequestUser, getUserSchool, getPDFPageCount, deductCredits,
} from "../lib/shared.js";

const MAX_PDF_PAGES = 80;   // Claude degrades above ~100 pages; 80 is safe
const MAX_FILE_MB   = 15;   // hard cap per file

const router = Router();

// POST /tests — create a new test
router.post("/tests", upload.single("questionPaper"), async (req, res) => {
  try {
    const { name, subject, totalMarks = 100, leniency = 3, instructions = "", class: cls, section, teacherId } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Test name is required" });

    let questionPaperUrl = null;
    let questionPaperContent = null;

    if (req.file) {
      const contentBlock = fileToClaudeContent(req.file);
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: "Extract and transcribe the complete question paper text. Include all questions with their marks allocations and any instructions. Preserve the question numbering and structure clearly." }] }],
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
      .insert({ name, subject, total_marks: parseInt(totalMarks), leniency: parseInt(leniency), instructions, question_paper_url: questionPaperUrl, question_paper_content: questionPaperContent, created_by: user?.id || null, school_id: schoolInfo?.school?.id || null, class: cls?.trim() || null, section: section?.trim() || null, teacher_id: teacherId || null })
      .select().single();
    if (error) throw error;
    res.json({ test: data });
  } catch (err) {
    console.error("Create test error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /extract-paper — auto-fill form from uploaded question paper
router.post("/extract-paper", upload.single("questionPaper"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const contentBlock = fileToClaudeContent(req.file);
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: [contentBlock, { type: "text", text: `Extract the following from this question paper and return ONLY valid JSON, no other text:\n{\n  "name": "<test/exam name>",\n  "subject": "<subject name>",\n  "totalMarks": <total marks as a number>,\n  "instructions": "<grading-relevant instructions, max 200 chars, or empty string>"\n}\nIf a field cannot be determined, use an empty string or 0 for totalMarks.` }] }],
    });
    const raw = response.content[0].text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(422).json({ error: "Could not parse response" });
    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error("Extract paper error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /tests — list tests visible to the current user
router.get("/tests", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ tests: [] });
    const user = await getRequestUser(req);
    const schoolInfo = user ? await getUserSchool(user.id, user.email) : null;
    let query = supabaseAdmin
      .from("analyzer_tests").select("*, analyzer_results(count)").order("created_at", { ascending: false });
    if (schoolInfo?.school?.id) {
      if (schoolInfo.role === "teacher") {
        query = query.eq("school_id", schoolInfo.school.id).eq("created_by", user.id);
      } else {
        query = query.eq("school_id", schoolInfo.school.id);
      }
    } else if (user?.id) {
      query = query.eq("created_by", user.id);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ tests: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Robust JSON extraction — handles preamble text, markdown fences, and truncation
function extractAnalysis(text, stopReason, totalMarks) {
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "");

  // 1. Direct parse
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  // 2. Find outermost { ... }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* continue */ }

    // 3. If truncated by max_tokens, try common closing suffixes to patch it
    if (stopReason === "max_tokens") {
      for (const suffix of ["]}}", "]}}}", "]}]}}", "]}\n}", "]}\n}}"]) {
        try { return JSON.parse(match[0] + suffix); } catch { /* continue */ }
      }
    }
  }

  return null;
}

// POST /tests/:testId/analyze — bulk analyze sheets via SSE
router.post("/tests/:testId/analyze", upload.array("sheets", 50), async (req, res) => {
  const { testId } = req.params;
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: "No files uploaded" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    let questionPaperContent = "", totalMarks = 100, leniency = 3, instructions = "", schoolId = null;
    if (supabaseAdmin) {
      const { data: test } = await supabaseAdmin
        .from("analyzer_tests").select("question_paper_content, total_marks, leniency, instructions, school_id")
        .eq("id", testId).single();
      if (test) {
        questionPaperContent = test.question_paper_content || "";
        totalMarks = test.total_marks || 100;
        leniency = test.leniency || 3;
        instructions = test.instructions || "";
        schoolId = test.school_id || null;
      }
    }

    const leniencyInstruction = LENIENCY_PROMPTS[leniency] || LENIENCY_PROMPTS[3];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      send({ type: "progress", index: i, total: files.length, filename: file.originalname, status: "analyzing" });
      try {
        // ── Pre-flight size/page checks ──────────────────────────────────────
        const fileMB = file.buffer.length / (1024 * 1024);
        if (fileMB > MAX_FILE_MB) {
          send({ type: "error", index: i, filename: file.originalname, error: `File is ${fileMB.toFixed(1)} MB — maximum allowed is ${MAX_FILE_MB} MB. Split into smaller files and upload again.` });
          continue;
        }
        let pdfPageCount = null;
        if (file.mimetype === "application/pdf") {
          pdfPageCount = getPDFPageCount(file.buffer);
          if (pdfPageCount !== null && pdfPageCount > MAX_PDF_PAGES) {
            send({ type: "error", index: i, filename: file.originalname, error: `PDF has ${pdfPageCount} pages — maximum is ${MAX_PDF_PAGES} pages. Each student's answer sheet must be uploaded as a separate file. If this is one student's sheet, export only their pages and try again.` });
            continue;
          }
        }

        // ── Credit deduction ────────────────────────────────────────────────
        const creditCost = file.mimetype === "application/pdf" ? (pdfPageCount || 1) : 1;
        const { ok: hasCredits } = await deductCredits(
          schoolId, creditCost, "analyze", `Sheet: ${file.originalname}`
        );
        if (!hasCredits) {
          send({ type: "error", index: i, filename: file.originalname, error: `Insufficient credits. This file requires ${creditCost} credit(s). Ask your admin to add more credits.` });
          continue;
        }

        const contentBlock = fileToClaudeContent(file);

        // Keep field values concise to stay within token budget for large papers
        const analyzePrompt = `You are an expert teacher analyzing a student's handwritten answer sheet.

${questionPaperContent ? `QUESTION PAPER:\n${questionPaperContent}\n` : "No question paper — evaluate based on what is visible in the sheet."}
TOTAL MARKS: ${totalMarks}
GRADING STRICTNESS: ${leniencyInstruction}
${instructions ? `TEACHER INSTRUCTIONS:\n${instructions}\n` : ""}

Instructions:
1. Extract student profile from the header (roll_no, name, class, section, subject, academic_year).
2. For EACH question: copy the question text from the paper, read the student's answer, evaluate it.
3. Keep all text fields under 40 words each — be concise but accurate.
4. marks_obtained must equal the sum of all marks_awarded values.

IMPORTANT: Your entire response must be a single valid JSON object. No markdown, no explanation, no text outside the JSON.

{
  "student": {
    "roll_no": "as written",
    "name": "full name",
    "class": "e.g. 10",
    "section": "if visible",
    "subject": "subject name",
    "academic_year": "e.g. 2024-25 or null"
  },
  "questions": [
    {
      "no": 1,
      "question": "exact question text from the paper (max 30 words)",
      "student_answer": "what student wrote (max 30 words)",
      "expected_answer": "correct answer (max 30 words)",
      "reasoning": "why these marks (max 30 words)",
      "marks_awarded": 8,
      "marks_available": 10,
      "feedback": "one sentence to student",
      "is_correct": false
    }
  ],
  "marks_obtained": 75,
  "total_marks": ${totalMarks},
  "strengths": ["max 2 items"],
  "improvement_areas": ["max 2 items"],
  "overall_feedback": "2 sentences max."
}`;

        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          messages: [
            { role: "user", content: [contentBlock, { type: "text", text: analyzePrompt }] },
          ],
        });

        const rawText = response.content[0]?.text || "";
        if (response.stop_reason === "max_tokens") {
          console.warn(`[analyze] max_tokens hit for ${file.originalname} — attempting partial recovery`);
        }

        let analysis = extractAnalysis(rawText, response.stop_reason, totalMarks);

        if (!analysis) {
          console.error(`[analyze] parse failed for ${file.originalname}. stop_reason=${response.stop_reason} snippet=${rawText.slice(0, 200)}`);
          analysis = { parse_error: true, raw: rawText, marks_obtained: 0, total_marks: totalMarks };
        }

        const student = analysis.student || {};
        let studentId = null, sheetUrl = null, resultId = null, shareToken = null;

        if (supabaseAdmin) {
          const ext = file.originalname.split(".").pop();
          sheetUrl = await uploadToStorage(
            "answer-sheets",
            `${testId}/${student.roll_no || `student-${i}`}-${Date.now()}.${ext}`,
            file.buffer,
            file.mimetype
          );

          if (student.roll_no) {
            let q = supabaseAdmin.from("analyzer_students").select("id, email").eq("roll_no", student.roll_no);
            if (schoolId) q = q.eq("school_id", schoolId);
            if (student.class) q = q.eq("class", student.class);
            if (student.academic_year) q = q.eq("academic_year", student.academic_year);
            const { data: existing } = await q.maybeSingle();
            if (existing) {
              await supabaseAdmin.from("analyzer_students")
                .update({ name: student.name, section: student.section }).eq("id", existing.id);
              studentId = existing.id;
            } else {
              const { data: ns } = await supabaseAdmin.from("analyzer_students")
                .insert({ roll_no: student.roll_no, name: student.name, class: student.class, section: student.section, academic_year: student.academic_year || null, school_id: schoolId })
                .select("id").single();
              studentId = ns?.id;
            }
          }

          const { data: result } = await supabaseAdmin.from("analyzer_results")
            .insert({ test_id: testId, student_id: studentId, original_sheet_url: sheetUrl, analysis, marks_obtained: analysis.marks_obtained || 0, total_marks: analysis.total_marks || totalMarks })
            .select("id, share_token").single();
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

// GET /tests/:testId/results — all results for a specific test
router.get("/tests/:testId/results", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ test: null, results: [] });
    const { testId } = req.params;
    const user = await getRequestUser(req);
    const schoolInfo = user ? await getUserSchool(user.id, user.email) : null;

    const { data: test, error: testErr } = await supabaseAdmin
      .from("analyzer_tests").select("id, name, subject, total_marks, leniency, created_by")
      .eq("id", testId).single();
    if (testErr || !test) return res.status(404).json({ error: "Test not found" });

    if (user && schoolInfo?.role === "teacher" && test.created_by !== user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { data: results, error } = await supabaseAdmin
      .from("analyzer_results")
      .select("id, marks_obtained, total_marks, analyzed_at, share_token, analysis, original_sheet_url, analyzer_students(id, name, roll_no, class, section, academic_year, email)")
      .eq("test_id", testId).order("analyzed_at", { ascending: false });
    if (error) throw error;
    res.json({ test, results: results || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /students — students who have results in school's tests
router.get("/students", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ students: [] });
    const user = await getRequestUser(req);
    const schoolInfo = user ? await getUserSchool(user.id, user.email) : null;
    const schoolId = schoolInfo?.school?.id;

    if (schoolInfo?.role === "teacher") {
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

    let query = supabaseAdmin.from("analyzer_students").select("*, analyzer_results(count)").order("name");
    if (schoolId) query = query.eq("school_id", schoolId);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ students: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /students/:id
router.get("/students/:id", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ student: null, results: [] });
    const user = await getRequestUser(req);
    const schoolInfo = user ? await getUserSchool(user.id, user.email) : null;
    const schoolId = schoolInfo?.school?.id;

    const [{ data: student }, { data: results }] = await Promise.all([
      supabaseAdmin.from("analyzer_students").select("*").eq("id", req.params.id).single(),
      supabaseAdmin.from("analyzer_results")
        .select("id, test_id, marks_obtained, total_marks, share_token, analyzed_at, analyzer_tests(id, name, subject)")
        .eq("student_id", req.params.id).order("analyzed_at", { ascending: false }),
    ]);

    const filtered = schoolId ? (results || []).filter((r) => r.analyzer_tests) : results || [];
    res.json({ student, results: filtered });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /results/:id
router.get("/results/:id", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ result: null });
    const { data, error } = await supabaseAdmin
      .from("analyzer_results")
      .select("*, analyzer_tests(name, subject, total_marks, created_by), analyzer_students(name, roll_no, class, section)")
      .eq("id", req.params.id).single();
    if (error) throw error;
    const user = await getRequestUser(req);
    if (user && data?.analyzer_tests?.created_by && data.analyzer_tests.created_by !== user.id) {
      return res.status(403).json({ error: "Not authorised" });
    }
    res.json({ result: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /results/:id
router.delete("/results/:id", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ ok: true });
    const user = await getRequestUser(req);
    const { data: result } = await supabaseAdmin
      .from("analyzer_results").select("id, analyzer_tests(created_by)").eq("id", req.params.id).single();
    if (!result) return res.status(404).json({ error: "Not found" });
    const schoolInfo = user ? await getUserSchool(user.id, user.email) : null;
    if (user && schoolInfo?.role === "teacher" && result.analyzer_tests?.created_by !== user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const { error } = await supabaseAdmin.from("analyzer_results").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /results/:id/assign
router.patch("/results/:id/assign", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ ok: true });
    const { studentId } = req.body;
    const user = await getRequestUser(req);
    const { data: result } = await supabaseAdmin
      .from("analyzer_results").select("id, analyzer_tests(created_by)").eq("id", req.params.id).single();
    if (!result) return res.status(404).json({ error: "Not found" });
    const schoolInfo = user ? await getUserSchool(user.id, user.email) : null;
    if (user && schoolInfo?.role === "teacher" && result.analyzer_tests?.created_by !== user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const { error } = await supabaseAdmin
      .from("analyzer_results").update({ student_id: studentId || null }).eq("id", req.params.id);
    if (error) throw error;
    let student = null;
    if (studentId) {
      const { data: s } = await supabaseAdmin
        .from("analyzer_students").select("id, name, roll_no, class, section, academic_year, email").eq("id", studentId).single();
      student = s;
    }
    res.json({ ok: true, student });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /results/:id/comments
router.patch("/results/:id/comments", async (req, res) => {
  try {
    const { comments } = req.body;
    if (!supabaseAdmin) return res.json({ ok: true });
    const { error } = await supabaseAdmin
      .from("analyzer_results").update({ teacher_comments: comments }).eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /share/:token — public, no auth
router.get("/share/:token", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ result: null });
    const { data, error } = await supabaseAdmin
      .from("analyzer_results")
      .select("*, analyzer_tests(name, subject, total_marks), analyzer_students(name, roll_no, class, section)")
      .eq("share_token", req.params.token).single();
    if (error) throw error;
    res.json({ result: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
