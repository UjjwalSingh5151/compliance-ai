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
  // Auth
  getAuthMe: () => json("/api/auth/me"),

  // School
  getMySchool: () => json("/api/school/me"),
  registerSchool: (name, contact_email) =>
    json("/api/school", { method: "POST", body: JSON.stringify({ name, contact_email }) }),
  getMembers: () => json("/api/school/members"),
  inviteMember: (email) =>
    json("/api/school/members/invite", { method: "POST", body: JSON.stringify({ email }) }),
  removeMember: (id) =>
    json(`/api/school/members/${id}`, { method: "DELETE" }),

  // Admin
  getAdminSchools: () => json("/api/admin/schools"),
  updateSchoolStatus: (id, status) =>
    json(`/api/admin/schools/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Teacher CRM
  getTeachers: () => json("/api/school/teachers"),
  addTeacher: (data) =>
    json("/api/school/teachers", { method: "POST", body: JSON.stringify(data) }),
  updateTeacher: (id, data) =>
    json(`/api/school/teachers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTeacher: (id) =>
    json(`/api/school/teachers/${id}`, { method: "DELETE" }),
  importTeachers: (teachers) =>
    json("/api/school/teachers/import", { method: "POST", body: JSON.stringify({ teachers }) }),

  // Student CRM
  getSchoolStudents: () => json("/api/school/students"),
  addStudent: (data) =>
    json("/api/school/students", { method: "POST", body: JSON.stringify(data) }),
  updateStudent: (id, data) =>
    json(`/api/school/students/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  importStudents: (students) =>
    json("/api/school/students/import", { method: "POST", body: JSON.stringify({ students }) }),

  // Tests
  getTests: () => json("/api/analyzer/tests"),
  getTestResults: (testId) => json(`/api/analyzer/tests/${testId}/results`),
  createTest: (formData) =>
    json("/api/analyzer/tests", { method: "POST", body: formData }),
  extractPaper: (file) => {
    const fd = new FormData();
    fd.append("questionPaper", file);
    return json("/api/analyzer/extract-paper", { method: "POST", body: fd });
  },

  analyzeSheets: async (testId, files, onEvent) => {
    const token = await getToken();
    const formData = new FormData();
    for (const file of files) formData.append("sheets", file);
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BASE}/api/analyzer/tests/${testId}/analyze`, {
      method: "POST", body: formData, headers,
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

  // Students & Results
  getStudents: () => json("/api/analyzer/students"),
  getStudent: (id) => json(`/api/analyzer/students/${id}`),
  getResult: (id) => json(`/api/analyzer/results/${id}`),
  deleteResult: (id) => json(`/api/analyzer/results/${id}`, { method: "DELETE" }),
  assignResult: (id, studentId) =>
    json(`/api/analyzer/results/${id}/assign`, { method: "PATCH", body: JSON.stringify({ studentId }) }),
  saveComments: (id, comments) =>
    json(`/api/analyzer/results/${id}/comments`, {
      method: "PATCH", body: JSON.stringify({ comments }),
    }),
  getShare: (token) => json(`/api/analyzer/share/${token}`),

  // Paper generator
  getPapers: () => json("/api/papers"),
  getPaper: (id) => json(`/api/papers/${id}`),
  generatePaper: (formData) =>
    json("/api/papers/generate", { method: "POST", body: formData }),
  transcribePaper: (formData) =>
    json("/api/papers/transcribe", { method: "POST", body: formData }),
  deletePaper: (id) =>
    json(`/api/papers/${id}`, { method: "DELETE" }),

  // Student portal
  getStudentMe: () => json("/api/student/me"),
  getStudentResults: () => json("/api/student/results"),
  getStudentResult: (id) => json(`/api/student/results/${id}`),
  generateRevisionNotes: (id) =>
    json(`/api/student/results/${id}/revision-notes`, { method: "POST" }),
  generatePracticeQuestions: (id, refresh = false) =>
    json(`/api/student/results/${id}/practice-questions`, { method: "POST", body: JSON.stringify({ refresh }) }),
  submitPracticeAttempt: (practiceSetId, answers) =>
    json(`/api/student/practice/${practiceSetId}/attempt`, { method: "POST", body: JSON.stringify({ answers }) }),
};
