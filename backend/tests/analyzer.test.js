/**
 * API tests for the analyzer routes.
 *
 * Strategy:
 * - Mock the Claude client and Supabase so no real I/O happens.
 * - Test the HTTP layer: correct status codes, response shapes,
 *   SSE event format, error handling.
 *
 * Run: cd backend && npm test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// ── Stubs ─────────────────────────────────────────────────────────────────────

const mockClaudeResponse = (text) => ({
  content:    [{ type: "text", text }],
  stop_reason: "end_turn",
  usage:      { input_tokens: 100, output_tokens: 200 },
});

// Minimal valid analysis JSON that matches extractAnalysis
const VALID_ANALYSIS = JSON.stringify({
  student:          { roll_no: "42", name: "Test Student", class: "10", section: "A" },
  questions:        [{ no: 1, question: "Q1", student_answer: "ans", expected_answer: "ans", reasoning: "correct", marks_awarded: 5, marks_available: 5, feedback: "Good", is_correct: true }],
  marks_obtained:   5,
  total_marks:      5,
  strengths:        ["Good attempt"],
  improvement_areas:[],
  overall_feedback: "Well done.",
});

// Mock shared.js — swap real clients with stubs
vi.mock("../lib/shared.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select:    vi.fn().mockReturnThis(),
      eq:        vi.fn().mockReturnThis(),
      single:    vi.fn().mockResolvedValue({
        data: { id: "test-id", question_paper_content: "Q1 (5 marks)", total_marks: 5, leniency: 3, instructions: "", school_id: "school-1" },
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert:    vi.fn().mockReturnThis(),
      update:    vi.fn().mockReturnThis(),
      order:     vi.fn().mockReturnThis(),
      limit:     vi.fn().mockReturnThis(),
      in:        vi.fn().mockReturnThis(),
    })),
    auth:    { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    storage: { from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }), getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/file.pdf" } })) }) ) },
  },
  client: {
    messages: { create: vi.fn().mockResolvedValue(mockClaudeResponse(VALID_ANALYSIS)) },
  },
  upload: {
    // Multer middleware stub — just moves to next()
    // array: preserve req.files if already injected by the test
    single: () => (_req, _res, next) => next(),
    array:  () => (req, _res, next) => { if (!req.files) req.files = []; next(); },
  },
  LENIENCY_PROMPTS: { 3: "Be BALANCED." },
  fileToClaudeContent: vi.fn(() => ({ type: "text", text: "stub" })),
  uploadToStorage:     vi.fn().mockResolvedValue("https://example.com/file.pdf"),
  getRequestUser:      vi.fn().mockResolvedValue(null),
  getUserSchool:       vi.fn().mockResolvedValue(null),
  getPDFPageCount:     vi.fn().mockReturnValue(1),
  checkCredits:        vi.fn().mockResolvedValue({ ok: true }),
  deductCredits:       vi.fn().mockResolvedValue({ ok: true }),
}));

// ── App setup ──────────────────────────────────────────────────────────────────

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: analyzerRouter } = await import("../routes/analyzer.js");
  app.use("/api/analyzer", analyzerRouter);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/analyzer/tests", () => {
  it("returns 200 with empty tests array when supabase has no data", async () => {
    // Override the mock to simulate an empty list
    const { supabaseAdmin } = await import("../lib/shared.js");
    supabaseAdmin.from.mockReturnValueOnce({
      select:  vi.fn().mockReturnThis(),
      order:   vi.fn().mockResolvedValue({ data: [], error: null }),
      eq:      vi.fn().mockReturnThis(),
    });

    const app = await buildApp();
    const res = await request(app).get("/api/analyzer/tests");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("tests");
    expect(Array.isArray(res.body.tests)).toBe(true);
  });
});

describe("GET /api/analyzer/share/:token", () => {
  it("returns 200 with result data for valid token", async () => {
    const { supabaseAdmin } = await import("../lib/shared.js");
    supabaseAdmin.from.mockReturnValueOnce({
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      single:  vi.fn().mockResolvedValue({
        data: {
          id:           "result-1",
          marks_obtained: 5,
          total_marks:  5,
          analysis:     JSON.parse(VALID_ANALYSIS),
          share_token:  "abc123",
          analyzer_tests:    { name: "Test", subject: "Math", total_marks: 5 },
          analyzer_students: { name: "Test Student", roll_no: "42", class: "10", section: "A" },
        },
        error: null,
      }),
    });

    const app = await buildApp();
    const res = await request(app).get("/api/analyzer/share/abc123");
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    expect(res.body.result.share_token).toBe("abc123");
  });

  it("returns 500 when share token not found", async () => {
    const { supabaseAdmin } = await import("../lib/shared.js");
    supabaseAdmin.from.mockReturnValueOnce({
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      single:  vi.fn().mockResolvedValue({ data: null, error: { message: "row not found" } }),
    });

    const app = await buildApp();
    const res = await request(app).get("/api/analyzer/share/invalid-token");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

describe("POST /api/analyzer/tests/:testId/analyze (SSE)", () => {
  it("returns 400 when no files uploaded", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/analyzer/tests/test-1/analyze")
      .field("nothing", "here");   // no sheets field
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no files/i);
  });

  it("SSE stream contains a result event for a valid PDF", async () => {
    // This test injects a fake file directly by patching multer middleware
    const { supabaseAdmin, client } = await import("../lib/shared.js");

    // Make Claude return valid analysis
    client.messages.create.mockResolvedValue(mockClaudeResponse(VALID_ANALYSIS));

    // Supabase: test lookup
    supabaseAdmin.from.mockImplementation(() => ({
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      single:      vi.fn().mockResolvedValue({
        data: { id: "test-id", question_paper_content: "Q1 (5 marks)", total_marks: 5, leniency: 3, instructions: "", school_id: "school-1" },
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      insert:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
    }));

    // Build a minimal express app that bypasses multer and injects a fake file
    const app = express();
    app.use(express.json());
    // Inject fake req.files before the router sees it
    app.use("/api/analyzer/tests/:testId/analyze", (req, _res, next) => {
      req.files = [{
        originalname: "test-sheet.pdf",
        mimetype:     "application/pdf",
        buffer:       Buffer.from("fake-pdf"),
      }];
      next();
    });
    const { default: analyzerRouter } = await import("../routes/analyzer.js");
    app.use("/api/analyzer", analyzerRouter);

    const res = await request(app)
      .post("/api/analyzer/tests/test-1/analyze");

    // SSE responses come back as text/event-stream
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);

    // Parse SSE events from body
    const events = res.text
      .split("\n")
      .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
      .map((l) => { try { return JSON.parse(l.slice(6)); } catch { return null; } })
      .filter(Boolean);

    const resultEvent = events.find((e) => e.type === "result");
    expect(resultEvent).toBeDefined();
    expect(resultEvent.analysis).toBeDefined();
    expect(resultEvent.analysis.marks_obtained).toBe(5);
  });
});

describe("extractAnalysis helper (internal)", () => {
  it("is tested indirectly via the analyze endpoint above");
});
