/**
 * API client — mirrors the web app's api.js but typed for TypeScript.
 * All calls go to the same Render backend. Swap API_URL env var to
 * point at a different environment (staging / prod).
 */

import { getAccessToken } from "./auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Test {
  id: string;
  name: string;
  subject?: string;
  total_marks: number;
  leniency: number;
  created_at: string;
  class?: string;
  section?: string;
  teacher_id?: string;
  analyzer_results?: { count: number }[];
}

export interface School {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  credits: number;
  contact_email?: string;
  owner_user_id: string;
  created_at?: string;
}

export interface Student {
  id: string;
  name?: string;
  roll_no?: string;
  class?: string;
  section?: string;
  academic_year?: string | null;
  email?: string;
  school_id?: string;
}

export interface TeacherProfile {
  id: string;
  name: string;
  email: string;
  subject?: string;
  class_assigned?: string;
  phone?: string;
  school_id: string;
}

export interface QuestionResult {
  no: number;
  question?: string;
  student_answer?: string;
  expected_answer?: string;
  reasoning?: string;
  marks_awarded: number;
  marks_available: number;
  feedback?: string;
  is_correct?: boolean;
}

export interface ResultAnalysis {
  student?: {
    name?: string;
    roll_no?: string;
    class?: string;
    section?: string;
    subject?: string;
    academic_year?: string | null;
  };
  questions?: QuestionResult[];
  marks_obtained: number;
  total_marks: number;
  strengths?: string[];
  improvement_areas?: string[];
  overall_feedback?: string;
  parse_error?: boolean;
  raw?: string;
}

export interface Result {
  id: string;
  test_id: string;
  student_id?: string;
  marks_obtained: number;
  total_marks: number;
  analyzed_at?: string;
  share_token?: string;
  original_sheet_url?: string;
  teacher_comments?: Record<string, string>;
  analysis: ResultAnalysis;
  analyzer_tests?: { name: string; subject?: string; total_marks: number; created_by?: string };
  analyzer_students?: Student;
}

export interface PracticeQuestion {
  no: number;
  question: string;
  options: string[];
  correct: string;
  explanation?: string;
}

export interface PracticeAttemptResult {
  score: number;
  total: number;
  results: Array<{ no: number; correct: boolean; selected: string; answer: string }>;
}

export interface AnalysisResult {
  resultId?: string;
  shareToken?: string;
  analysis: ResultAnalysis;
}

// ─── API methods ──────────────────────────────────────────────────────────────

export const api = {
  // School
  getMySchool: () => request<{ status: string; school?: School; role?: string }>("/api/school/me"),
  getCredits:  () => request<{ credits: number }>("/api/school/credits"),

  // Tests
  getTests: () => request<{ tests: Test[] }>("/api/analyzer/tests"),
  createTest: (formData: FormData) =>
    request<{ test: Test }>("/api/analyzer/tests", { method: "POST", body: formData }),

  // Analyze — single PDF upload (used by camera flow after on-device PDF creation)
  analyzeSheet: (
    testId: string,
    pdfUri: string,
    fileName: string,
    onEvent: (e: AnalysisResult & { type: string; index?: number; filename?: string; error?: string }) => void
  ): Promise<void> => {
    // React Native's fetch does NOT support res.body.getReader() (no ReadableStream).
    // Use XMLHttpRequest instead — onprogress fires as SSE chunks arrive.
    return new Promise(async (resolve, reject) => {
      const token = await getAccessToken();

      const formData = new FormData();
      formData.append("sheets", {
        uri: pdfUri,
        name: fileName,
        type: "application/pdf",
      } as any);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/analyzer/tests/${testId}/analyze`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      let processed = 0;

      const processChunk = (text: string) => {
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { resolve(); return; }
          try { onEvent(JSON.parse(raw)); } catch { /* skip malformed line */ }
        }
      };

      xhr.onprogress = () => {
        const newText = xhr.responseText.slice(processed);
        processed = xhr.responseText.length;
        processChunk(newText);
      };

      xhr.onload = () => {
        // Catch anything not yet processed
        const remaining = xhr.responseText.slice(processed);
        if (remaining) processChunk(remaining);
        resolve();
      };

      xhr.onerror = () => reject(new Error(`Network error (status ${xhr.status})`));
      xhr.ontimeout = () => reject(new Error("Request timed out"));
      xhr.timeout = 5 * 60 * 1000; // 5 min — Claude can be slow

      xhr.send(formData);
    });
  },

  // Extract details from question paper image/PDF
  extractPaper: (formData: FormData) =>
    request<{ name: string; subject: string; totalMarks: number; instructions: string }>(
      "/api/analyzer/extract-paper",
      { method: "POST", body: formData }
    ),

  // Papers (opaque shape — generated by AI, structure varies)
  getPapers: () => request<{ papers: Record<string, unknown>[] }>("/api/papers"),
  transcribePaper: (formData: FormData) =>
    request<{ paper: Record<string, unknown> }>("/api/papers/transcribe", { method: "POST", body: formData }),
  generatePaper: (formData: FormData) =>
    request<{ paper: Record<string, unknown> }>("/api/papers/generate", { method: "POST", body: formData }),

  // Test results
  getTestResults: (testId: string) =>
    request<{ test: Test; results: Result[] }>(`/api/analyzer/tests/${testId}/results`),
  getResult: (id: string) =>
    request<{ result: Result }>(`/api/analyzer/results/${id}`),
  saveComments: (id: string, comments: Record<string, string>) =>
    request(`/api/analyzer/results/${id}/comments`, {
      method: "PATCH", body: JSON.stringify({ comments }),
    }),

  // Teacher self-profile (CRM record matched by auth email)
  getMyTeacherProfile: () => request<{ teacher: TeacherProfile | null }>("/api/school/teachers/me"),

  // Analytics (shape varies by role — keeping loose intentionally)
  getMyAnalytics: () => request<Record<string, unknown>>("/api/analytics/me"),

  // Student portal (authenticated, email-matched)
  getStudentMe: () => request<{ student: Student }>("/api/student/me"),
  getStudentResults: () =>
    request<{ student: Student; results: Result[] }>("/api/student/results"),
  getStudentResult: (id: string) =>
    request<{ result: Result; practiceSet: { id: string; questions: PracticeQuestion[] } | null }>(`/api/student/results/${id}`),
  generateRevisionNotes: (id: string) =>
    request<{ notes: string }>(`/api/student/results/${id}/revision-notes`, { method: "POST" }),
  generatePracticeQuestions: (id: string, refresh = false) =>
    request<{ practiceSetId: string; questions: PracticeQuestion[] }>(
      `/api/student/results/${id}/practice-questions`,
      { method: "POST", body: JSON.stringify({ refresh }) }
    ),
  submitPracticeAttempt: (practiceSetId: string, answers: { no: number; selected: string }[]) =>
    request<PracticeAttemptResult>(
      `/api/student/practice/${practiceSetId}/attempt`,
      { method: "POST", body: JSON.stringify({ answers }) }
    ),

  // Public share — no auth, used by ShareResultScreen
  getShare: async (token: string): Promise<{ result: Result }> => {
    const res = await fetch(`${API_URL}/api/analyzer/share/${token}`);
    if (!res.ok) throw new Error(`Share not found (${res.status})`);
    return res.json();
  },
};
