const BASE = import.meta.env.VITE_API_URL || "";

async function json(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Tests
  getTests: () => json("/api/analyzer/tests"),

  createTest: (formData) =>
    json("/api/analyzer/tests", { method: "POST", body: formData }),

  // Analyze — streams SSE events, calls onEvent(event) for each
  analyzeSheets: async (testId, files, onEvent) => {
    const formData = new FormData();
    for (const file of files) formData.append("sheets", file);

    const res = await fetch(`${BASE}/api/analyzer/tests/${testId}/analyze`, {
      method: "POST",
      body: formData,
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

  // Students
  getStudents: () => json("/api/analyzer/students"),
  getStudent: (id) => json(`/api/analyzer/students/${id}`),

  // Results
  getResult: (id) => json(`/api/analyzer/results/${id}`),

  // Teacher comments
  saveComments: (id, comments) =>
    json(`/api/analyzer/results/${id}/comments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments }),
    }),

  // Share (public)
  getShare: (token) => json(`/api/analyzer/share/${token}`),
};
