/**
 * Vitest global test setup.
 * Loads .env.test (if present) and stubs the Langfuse + Supabase
 * clients so no real network calls happen during testing.
 */

import { vi } from "vitest";

// ── Environment ────────────────────────────────────────────────────────────────
// Minimal env so shared.js doesn't throw
process.env.ANTHROPIC_API_KEY   = process.env.ANTHROPIC_API_KEY   || "sk-ant-test";
process.env.SUPABASE_URL        = process.env.SUPABASE_URL        || "";
process.env.SUPABASE_SERVICE_KEY= process.env.SUPABASE_SERVICE_KEY|| "";
process.env.ADMIN_USER_ID       = process.env.ADMIN_USER_ID       || "test-admin-id";
process.env.CORS_ORIGINS        = "http://localhost:5173";

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Langfuse — always a no-op in tests
vi.mock("langfuse", () => ({
  Langfuse: class {
    trace()      { return { generation: () => ({ end: vi.fn() }), id: "trace-test-id", score: vi.fn() }; }
    score()      {}
    flushAsync() { return Promise.resolve(); }
  },
}));
