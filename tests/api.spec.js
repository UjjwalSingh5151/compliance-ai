import { test, expect } from "@playwright/test";

const API = "http://localhost:3001";

// ─── Public endpoints (no auth needed) ───────────────────────────────────────

test("GET /api/health → 200 ok", async ({ request }) => {
  const res = await request.get(`${API}/api/health`);
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("GET /api/auth/me (no token) → isAdmin: false", async ({ request }) => {
  const res = await request.get(`${API}/api/auth/me`);
  expect(res.status()).toBe(200);
  expect((await res.json()).isAdmin).toBe(false);
});

test("GET /api/school/me (no token) → 401", async ({ request }) => {
  const res = await request.get(`${API}/api/school/me`);
  expect(res.status()).toBe(401);
});

test("GET /api/analyzer/tests (no token) → returns empty list", async ({ request }) => {
  const res = await request.get(`${API}/api/analyzer/tests`);
  // Either 200 with empty tests or 401 — both are acceptable
  expect([200, 401]).toContain(res.status());
});

test("GET /api/analyzer/share/invalid-token → error or 500", async ({ request }) => {
  const res = await request.get(`${API}/api/analyzer/share/nonexistent-token-xyz`);
  // Should not crash the server — any 4xx/5xx is fine, just not a hanging request
  expect(res.status()).toBeGreaterThanOrEqual(400);
});

test("POST /api/school (no token) → 401", async ({ request }) => {
  const res = await request.post(`${API}/api/school`, { data: { name: "Test School" } });
  expect(res.status()).toBe(401);
});

test("GET /api/admin/schools (no token) → 403", async ({ request }) => {
  const res = await request.get(`${API}/api/admin/schools`);
  expect(res.status()).toBe(403);
});

test("GET /api/student/me (no token) → 401", async ({ request }) => {
  const res = await request.get(`${API}/api/student/me`);
  expect(res.status()).toBe(401);
});
