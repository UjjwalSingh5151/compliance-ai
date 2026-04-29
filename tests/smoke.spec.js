import { test, expect } from "@playwright/test";

// ─── Backend health ───────────────────────────────────────────────────────────

test("backend /api/health returns ok", async ({ request }) => {
  const res = await request.get("http://localhost:3001/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.ok).toBe(true);
});

// ─── Frontend loads ───────────────────────────────────────────────────────────

test("app loads login screen", async ({ page }) => {
  await page.goto("/");
  // Should show EduGrade branding
  await expect(page.getByText("EduGrade")).toBeVisible();
});

test("login screen shows email and password fields", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
});

test("signup tab switches mode", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Sign up").click();
  await expect(page.getByPlaceholder("Your name")).toBeVisible();
});

test("login with wrong credentials shows error", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill("notreal@example.com");
  await page.getByPlaceholder("Password").fill("wrongpassword");
  await page.getByRole("button", { name: "Log in" }).click();
  // Should show some error message (Supabase will return invalid login)
  await expect(page.locator("div").filter({ hasText: /invalid|incorrect|wrong|error/i }).first()).toBeVisible({ timeout: 10_000 });
});
