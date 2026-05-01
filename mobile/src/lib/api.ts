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

export interface AnalysisResult {
  resultId?: string;
  shareToken?: string;
  analysis: {
    student?: { name?: string; roll_no?: string; class?: string };
    marks_obtained: number;
    total_marks: number;
    overall_feedback?: string;
    strengths?: string[];
    improvement_areas?: string[];
    parse_error?: boolean;
  };
}

// ─── API methods ──────────────────────────────────────────────────────────────

export const api = {
  // School
  getMySchool: () => request<{ status: string; school?: any; role?: string }>("/api/school/me"),
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
    onEvent: (e: any) => void
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

  // Papers
  getPapers: () => request<{ papers: any[] }>("/api/papers"),
  transcribePaper: (formData: FormData) =>
    request<{ paper: any }>("/api/papers/transcribe", { method: "POST", body: formData }),
  generatePaper: (formData: FormData) =>
    request<{ paper: any }>("/api/papers/generate", { method: "POST", body: formData }),

  // Test results
  getTestResults: (testId: string) =>
    request<{ test: any; results: any[] }>(`/api/analyzer/tests/${testId}/results`),
  getResult: (id: string) =>
    request<{ result: any }>(`/api/analyzer/results/${id}`),

  // Analytics
  getMyAnalytics: () => request<any>("/api/analytics/me"),
};
