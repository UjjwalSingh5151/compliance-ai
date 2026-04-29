import { Router } from "express";
import {
  supabaseAdmin, client, upload,
  LENIENCY_PROMPTS, fileToClaudeContent, uploadToStorage,
  getRequestUser, getUserSchool,
} from "../lib/shared.js";

const router = Router();

// POST /tests — create a new test
router.post("/tests", upload.single("questionPaper"), async (req, res) => {
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
      .insert({ name, subject, total_marks: parseInt(totalMarks), leniency: parseInt(leniency), instructions, question_paper_url: questionPaperUrl, question_paper_content: questionPaperContent, created_by: user?.id || null, school_id: schoolInfo?.school?.id || null })
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
    let questionPaperContent = "", totalMarks = 100, leniency = 3, instructions = "";
    if (supabaseAdmin) {
      const { data: test } = await supabaseAdmin
        .from("analyzer_tests").select("question_paper_content, total_marks, leniency, instructions")
        .eq("id", testId).single();
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
      "student_answer": "1-2 sentence summary of what the student wrote.",
      "expected_answer": "The correct answer in 1-2 sentences.",
      "reasoning": "2-3 sentences: what is correct, what is missing or wrong, how marks were calculated.",
      "marks_awarded": 8,
      "marks_available": 10,
      "feedback": "One concise, actionable sentence of feedback directly to the student.",
      "is_correct": false
    }
  ],
  "marks_obtained": 75,
  "total_marks": ${totalMarks},
  "improvement_areas": ["specific topic or skill needing improvement"],
  "strengths": ["what the student did well"],
  "overall_feedback": "1-2 sentence honest overall assessment of performance and what to focus on next."
}`;

        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: analyzePrompt }] }],
        });

        let analysis;
        try {
          const text = response.content[0].text;
          let parsed;
          try { parsed = JSON.parse(text.trim()); }
          catch {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found in response");
            parsed = JSON.parse(jsonMatch[0]);
          }
          analysis = parsed;
          if (response.stop_reason === "max_tokens") {
            console.warn(`[analyze] Token limit hit for ${file.originalname} — response may be incomplete`);
          }
        } catch (parseErr) {
          const raw = response.content[0]?.text || "";
          console.error(`[analyze] JSON parse failed for ${file.originalname}. stop_reason=${response.stop_reason} raw_snippet=${raw.slice(0, 300)}`);
          analysis = { parse_error: true, raw, marks_obtained: 0, total_marks: totalMarks };
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

          const { data: testRow } = await supabaseAdmin
            .from("analyzer_tests").select("school_id").eq("id", testId).single();
          const schoolId = testRow?.school_id || null;

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
