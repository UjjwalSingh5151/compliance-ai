import { Router } from "express";
import {
  supabaseAdmin, client, upload,
  fileToClaudeContent, uploadToStorage, getPDFPageCount, deductCredits,
  requireSchool,
} from "../lib/shared.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPaperJSON(text, stopReason) {
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "");
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* continue */ }
    if (stopReason === "max_tokens") {
      for (const s of ["}]}", "}]}}", "}]}\n}"]) {
        try { return JSON.parse(match[0] + s); } catch { /* continue */ }
      }
    }
  }
  return null;
}

const PAPER_SCHEMA = `{
  "title": "short test title",
  "header": { "class": "...", "subject": "...", "board": "...", "total_marks": N, "time": "e.g. 1 hour 30 minutes" },
  "general_instructions": ["instruction 1", "..."],
  "sections": [
    {
      "name": "Section A",
      "description": "e.g. Multiple Choice — 1 mark each",
      "questions": [
        {
          "no": 1,
          "text": "Full question text",
          "marks": 1,
          "options": ["(a) ...", "(b) ...", "(c) ...", "(d) ..."]
        }
      ]
    }
  ]
}
Note: set "options" to null for non-MCQ questions. Marks across all sections must sum to total_marks.`;

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET / — list papers for this school
router.get("/", requireSchool, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("generated_papers")
      .select("id, title, class, subject, board, total_marks, difficulty, mode, created_at")
      .eq("school_id", req.school.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ papers: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /:id — full paper with content
router.get("/:id", requireSchool, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("generated_papers").select("*")
      .eq("id", req.params.id).eq("school_id", req.school.id).single();
    if (error) throw error;
    res.json({ paper: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /generate — Mode 1: AI generates paper from specs + optional format sample
router.post(
  "/generate",
  requireSchool,
  upload.fields([{ name: "format", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { cls, subject, board = "CBSE", totalMarks = 50, difficulty = "medium", extraInstructions = "" } = req.body;
      if (!subject?.trim()) return res.status(400).json({ error: "Subject is required" });

      const formatFile = req.files?.format?.[0];
      let formatUrl = null;
      if (formatFile) {
        formatUrl = await uploadToStorage(
          "generated-papers",
          `formats/${Date.now()}-${formatFile.originalname.replace(/\s+/g, "_")}`,
          formatFile.buffer,
          formatFile.mimetype
        );
      }

      // 1 credit per generation call
      const { ok: hasCredits } = await deductCredits(req.school.id, 1, "generate", `Paper: ${subject}`);
      if (!hasCredits) return res.status(402).json({ error: "Insufficient credits to generate a paper. Ask your admin to add more credits." });

      const prompt = `You are an expert teacher creating a question paper.
${formatFile ? "A FORMAT REFERENCE document is attached — follow its section structure, question types, and layout style exactly." : ""}

Specifications:
- Class: ${cls || "not specified"}
- Subject: ${subject.trim()}
- Board: ${board}
- Total Marks: ${totalMarks}
- Difficulty: ${difficulty}
${extraInstructions ? `- Additional: ${extraInstructions}` : ""}

Return ONLY valid JSON — no markdown fences, no text outside the JSON:
${PAPER_SCHEMA}`;

      const userContent = formatFile
        ? [fileToClaudeContent(formatFile), { type: "text", text: prompt }]
        : [{ type: "text", text: prompt }];

      // Deduct 5 credits for AI paper generation
      const { ok: hasCredits } = await deductCredits(
        req.school.id, 5, "generate", `AI generate: ${subject.trim()}`
      );
      if (!hasCredits) return res.status(402).json({ error: "Insufficient credits. Ask your admin to add more credits." });

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content: userContent }],
      });

      const rawText = response.content[0]?.text || "";
      const content = extractPaperJSON(rawText, response.stop_reason);
      if (!content) return res.status(422).json({ error: "Could not parse Claude's response. Try again or simplify the request." });

      const title = content.title || `${subject.trim()} Paper`;
      const { data, error } = await supabaseAdmin
        .from("generated_papers")
        .insert({
          school_id: req.school.id,
          created_by: req.user?.id || null,
          mode: "ai",
          title,
          class: cls?.trim() || null,
          subject: subject.trim(),
          board,
          total_marks: parseInt(totalMarks),
          difficulty,
          content,
          format_url: formatUrl,
        })
        .select().single();
      if (error) throw error;
      res.json({ paper: data });
    } catch (err) {
      console.error("Generate paper error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /transcribe — Mode 2: type out handwritten paper in the uploaded format
router.post(
  "/transcribe",
  requireSchool,
  upload.fields([{ name: "format", maxCount: 1 }, { name: "handwritten", maxCount: 1 }]),
  async (req, res) => {
    try {
      const formatFile = req.files?.format?.[0];
      const handwrittenFile = req.files?.handwritten?.[0];
      if (!formatFile) return res.status(400).json({ error: "Format document is required" });
      if (!handwrittenFile) return res.status(400).json({ error: "Handwritten paper is required" });

      // Deduct credits: 1 per page of handwritten file (the content being scanned)
      const hwPages = handwrittenFile.mimetype === "application/pdf"
        ? (getPDFPageCount(handwrittenFile.buffer) || 1) : 1;
      const { ok: hasCredits } = await deductCredits(req.school.id, hwPages, "transcribe", `Transcribe: ${handwrittenFile.originalname}`);
      if (!hasCredits) return res.status(402).json({ error: `Insufficient credits. Transcription requires ${hwPages} credit(s). Ask your admin to add more credits.` });

      const [formatUrl, sourceUrl] = await Promise.all([
        uploadToStorage(
          "generated-papers",
          `formats/${Date.now()}-${formatFile.originalname.replace(/\s+/g, "_")}`,
          formatFile.buffer,
          formatFile.mimetype
        ),
        uploadToStorage(
          "generated-papers",
          `handwritten/${Date.now()}-${handwrittenFile.originalname.replace(/\s+/g, "_")}`,
          handwrittenFile.buffer,
          handwrittenFile.mimetype
        ),
      ]);

      // Deduct 3 credits for transcription
      const { ok: hasCredits } = await deductCredits(
        req.school.id, 3, "transcribe", `Transcribe: ${handwrittenFile.originalname}`
      );
      if (!hasCredits) return res.status(402).json({ error: "Insufficient credits. Ask your admin to add more credits." });

      const prompt = `You are an expert teacher digitizing a handwritten question paper.

The FIRST document is the FORMAT REFERENCE — follow its layout, section structure, typography style, and formatting exactly.
The SECOND document is the HANDWRITTEN PAPER — transcribe every question from it accurately, preserving numbering and marks.

Do not skip or paraphrase any questions. If handwriting is unclear, make your best interpretation.

Return ONLY valid JSON — no markdown fences, no text outside the JSON:
${PAPER_SCHEMA}`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [
              fileToClaudeContent(formatFile),
              fileToClaudeContent(handwrittenFile),
              { type: "text", text: prompt },
            ],
          },
        ],
      });

      const rawText = response.content[0]?.text || "";
      const content = extractPaperJSON(rawText, response.stop_reason);
      if (!content) return res.status(422).json({ error: "Could not parse Claude's response. The handwriting may be too unclear — try a clearer photo." });

      const title = content.title || `Transcribed Paper`;
      const { data, error } = await supabaseAdmin
        .from("generated_papers")
        .insert({
          school_id: req.school.id,
          created_by: req.user?.id || null,
          mode: "transcribe",
          title,
          class: content.header?.class || null,
          subject: content.header?.subject || null,
          board: content.header?.board || null,
          total_marks: content.header?.total_marks || null,
          difficulty: null,
          content,
          format_url: formatUrl,
          source_url: sourceUrl,
        })
        .select().single();
      if (error) throw error;
      res.json({ paper: data });
    } catch (err) {
      console.error("Transcribe paper error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /:id
router.delete("/:id", requireSchool, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("generated_papers").delete()
      .eq("id", req.params.id).eq("school_id", req.school.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
