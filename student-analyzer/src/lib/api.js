import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL || "";

async function getToken() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function json(path, opts = {}) {
  const token = await getToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Don't set Content-Type for FormData — browser sets it with boundary
  if (!(opts.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getTests: () => json("/api/analyzer/tests"),

  createTest: (formData) =>
    json("/api/analyzer/tests", { method: "POST", body: formData }),

  analyzeSheets: async (testId, files, onEvent) => {
    const token = await getToken();
    const formData = new FormData();
    for (const file of files) formData.append("sheets", file);

    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${BASE}/api/analyzer/tests/${testId}/analyze`, {
      method: "POST",
      body: formData,
      headers,
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6);
        if (raw === "[DONE]") return;
        try { onEvent(JSON.parse(raw)); } catch { /* skip */ }
      }
    }
  },

  getStudents: () => json("/api/analyzer/students"),
  getStudent: (id) => json(`/api/analyzer/students/${id}`),
  getResult: (id) => json(`/api/analyzer/results/${id}`),

  saveComments: (id, comments) =>
    json(`/api/analyzer/results/${id}/comments`, {
      method: "PATCH",
      body: JSON.stringify({ comments }),
    }),

  getShare: (token) => json(`/api/analyzer/share/${token}`),
};
