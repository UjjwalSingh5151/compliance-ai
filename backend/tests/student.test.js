/**
 * API tests for student routes.
 */

import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

const MOCK_STUDENT = {
  id: "student-1", name: "Arjun Sharma", roll_no: "42",
  class: "10", section: "A", email: "arjun@test.com",
  schools: { name: "Test School", status: "approved" },
};

const MOCK_RESULT = {
  id: "result-1",
  marks_obtained: 42, total_marks: 50,
  analyzed_at: new Date().toISOString(),
  share_token: "tok-abc",
  revision_notes: null,
  analysis: {
    questions: [
      { no: 1, question: "Q1", student_answer: "wrong", expected_answer: "right",
        marks_awarded: 2, marks_available: 5, feedback: "Partial", reasoning: "" },
    ],
    marks_obtained: 42, total_marks: 50,
    strengths: ["Good effort"], improvement_areas: ["Algebra"],
    overall_feedback: "Keep it up.",
  },
  analyzer_tests:    { name: "Math Mid-term", subject: "Math", total_marks: 50, question_paper_content: "Q1..." },
  analyzer_students: { name: "Arjun Sharma", roll_no: "42", class: "10", section: "A" },
};

// ── Shared.js mock ─────────────────────────────────────────────────────────────
vi.mock("../lib/shared.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      single:      vi.fn().mockResolvedValue({ data: MOCK_RESULT, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_STUDENT, error: null }),
      insert:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
    })),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "arjun@test.com" } } }) },
  },
  client: {
    messages: {
      create: vi.fn().mockResolvedValue({
        content:    [{ type: "text", text: "Here are your revision notes..." }],
        stop_reason: "end_turn",
        usage:      { input_tokens: 100, output_tokens: 200 },
      }),
    },
  },
  getRequestUser: vi.fn().mockResolvedValue({ id: "user-1", email: "arjun@test.com" }),
}));

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: studentRouter } = await import("../routes/student.js");
  app.use("/api/student", studentRouter);
  return app;
}

describe("GET /api/student/me", () => {
  it("returns student data for valid token", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/student/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.student).toBeDefined();
    expect(res.body.student.name).toBe("Arjun Sharma");
  });
});

describe("GET /api/student/results", () => {
  it("returns results list", async () => {
    const { supabaseAdmin } = await import("../lib/shared.js");
    supabaseAdmin.from.mockReturnValueOnce({
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_STUDENT }),
    });
    supabaseAdmin.from.mockReturnValueOnce({
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      order:   vi.fn().mockResolvedValue({ data: [MOCK_RESULT], error: null }),
    });

    const app = await buildApp();
    const res = await request(app)
      .get("/api/student/results")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });
});

describe("POST /api/student/results/:id/revision-notes", () => {
  it("generates and returns revision notes", async () => {
    const { supabaseAdmin } = await import("../lib/shared.js");

    // getStudentByEmail
    supabaseAdmin.from.mockReturnValueOnce({
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_STUDENT }),
    });
    // get result (no existing notes)
    supabaseAdmin.from.mockReturnValueOnce({
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      single:  vi.fn().mockResolvedValue({ data: { ...MOCK_RESULT, revision_notes: null } }),
    });
    // update result with notes
    supabaseAdmin.from.mockReturnValueOnce({
      update:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockResolvedValue({ error: null }),
    });

    const app = await buildApp();
    const res = await request(app)
      .post("/api/student/results/result-1/revision-notes")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.notes).toBeDefined();
    expect(typeof res.body.notes).toBe("string");
  });

  it("returns cached notes if they exist", async () => {
    const { supabaseAdmin } = await import("../lib/shared.js");

    supabaseAdmin.from.mockReturnValueOnce({
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_STUDENT }),
    });
    supabaseAdmin.from.mockReturnValueOnce({
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      single:  vi.fn().mockResolvedValue({ data: { ...MOCK_RESULT, revision_notes: "Existing notes" } }),
    });

    const app = await buildApp();
    const res = await request(app)
      .post("/api/student/results/result-1/revision-notes")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe("Existing notes");
  });
});

describe("POST /api/student/practice/:id/attempt", () => {
  it("scores a practice attempt correctly", async () => {
    const { supabaseAdmin } = await import("../lib/shared.js");

    const questions = [
      { no: 1, question: "Q1", options: ["A) a","B) b","C) c","D) d"], correct: "B", explanation: "Because B." },
      { no: 2, question: "Q2", options: ["A) a","B) b","C) c","D) d"], correct: "A", explanation: "Because A." },
    ];

    // get practice set
    supabaseAdmin.from.mockReturnValueOnce({
      select:  vi.fn().mockReturnThis(),
      eq:      vi.fn().mockReturnThis(),
      single:  vi.fn().mockResolvedValue({ data: { questions } }),
    });
    // insert attempt
    supabaseAdmin.from.mockReturnValueOnce({
      insert:  vi.fn().mockResolvedValue({ error: null }),
    });

    const app = await buildApp();
    const res = await request(app)
      .post("/api/student/practice/pset-1/attempt")
      .set("Authorization", "Bearer valid-token")
      .send({ answers: [{ no: 1, selected: "B" }, { no: 2, selected: "C" }] });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(1);   // only Q1 is correct
    expect(res.body.total).toBe(2);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].correct).toBe(true);
    expect(res.body.results[1].correct).toBe(false);
  });
});
