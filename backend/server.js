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

// ─── Student Analyzer ────────────────────────────────────────────────────────

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

// Extract and verify the Supabase user from the request's Authorization header
async function getRequestUser(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || !supabaseAdmin) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user || null;
  } catch { return null; }
}

// Get all test IDs owned by a user (used to scope student/result queries)
async function getUserTestIds(userId) {
  if (!supabaseAdmin || !userId) return null;
  const { data } = await supabaseAdmin
    .from("analyzer_tests")
    .select("id")
    .eq("created_by", userId);
  return (data || []).map((t) => t.id);
}

const LENIENCY_PROMPTS = {
  1: "Be VERY STRICT. Award full marks only for perfectly correct answers with proper terminology, complete working, and no errors whatsoever.",
  2: "Be STRICT. Minor errors in presentation or terminology should result in mark deductions. Expect complete and well-structured answers.",
  3: "Be BALANCED. Award marks for correct concepts even if presentation isn't perfect. Small calculation errors may lose 1 mark but not more.",
  4: "Be LENIENT. Award marks generously if the student demonstrates understanding, even with minor errors or incomplete steps.",
  5: "Be VERY LENIENT. Give maximum benefit of doubt. Award marks for any reasonable attempt that shows partial understanding.",
};

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
    const { data, error } = await supabaseAdmin
      .from("analyzer_tests")
      .insert({ name, subject, total_marks: parseInt(totalMarks), leniency: parseInt(leniency), instructions, question_paper_url: questionPaperUrl, question_paper_content: questionPaperContent, created_by: user?.id || null })
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
    let query = supabaseAdmin
      .from("analyzer_tests")
      .select("*, analyzer_results(count)")
      .order("created_at", { ascending: false });
    if (user?.id) query = query.eq("created_by", user.id);
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
1. Extract the student's profile from the first page or header (roll number, name, class/grade, section, subject).
2. For EACH question: read the student's answer carefully, then evaluate it against the expected correct answer.
3. Provide your reasoning BEFORE awarding marks — explain what is correct, what is missing or wrong, and why you are giving those marks.
4. Identify specific improvement areas and strengths based on the overall performance.

Respond ONLY with valid JSON (no markdown fences, no explanation outside JSON) in this exact format:
{
  "student": {
    "roll_no": "roll number as written",
    "name": "full name as written",
    "class": "class or grade",
    "section": "section if visible",
    "subject": "subject name"
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
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4000,
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

          // Upsert student by roll number
          if (student.roll_no) {
            const { data: existing } = await supabaseAdmin
              .from("analyzer_students")
              .select("id")
              .eq("roll_no", student.roll_no)
              .maybeSingle();

            if (existing) {
              await supabaseAdmin.from("analyzer_students")
                .update({ name: student.name, class: student.class, section: student.section })
                .eq("id", existing.id);
              studentId = existing.id;
            } else {
              const { data: ns } = await supabaseAdmin.from("analyzer_students")
                .insert({ roll_no: student.roll_no, name: student.name, class: student.class, section: student.section })
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

// GET /api/analyzer/students
app.get("/api/analyzer/students", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ students: [] });
    const user = await getRequestUser(req);
    const testIds = await getUserTestIds(user?.id);

    // If user has no tests yet, return empty
    if (testIds && testIds.length === 0) return res.json({ students: [] });

    // Get student IDs from results belonging to user's tests
    let studentQuery = supabaseAdmin.from("analyzer_results").select("student_id");
    if (testIds) studentQuery = studentQuery.in("test_id", testIds);
    const { data: resultRows } = await studentQuery;
    const studentIds = [...new Set((resultRows || []).map((r) => r.student_id).filter(Boolean))];

    if (studentIds.length === 0) return res.json({ students: [] });

    const { data, error } = await supabaseAdmin
      .from("analyzer_students")
      .select("*, analyzer_results(count)")
      .in("id", studentIds)
      .order("name");
    if (error) throw error;
    res.json({ students: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyzer/students/:id
app.get("/api/analyzer/students/:id", async (req, res) => {
  try {
    if (!supabaseAdmin) return res.json({ student: null, results: [] });
    const user = await getRequestUser(req);
    const testIds = await getUserTestIds(user?.id);

    const [{ data: student }, { data: allResults }] = await Promise.all([
      supabaseAdmin.from("analyzer_students").select("*").eq("id", req.params.id).single(),
      supabaseAdmin.from("analyzer_results")
        .select("id, marks_obtained, total_marks, share_token, analyzed_at, analyzer_tests(name, subject)")
        .eq("student_id", req.params.id)
        .order("analyzed_at", { ascending: false }),
    ]);

    // Filter results to only this user's tests
    const results = testIds
      ? (allResults || []).filter((r) => testIds.includes(r.test_id || r.analyzer_tests?.id))
      : allResults || [];

    res.json({ student, results });
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

// ─── Static frontend ─────────────────────────────────────────────────────────

const frontendDist = path.join(__dirname, "../student-analyzer/dist");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
