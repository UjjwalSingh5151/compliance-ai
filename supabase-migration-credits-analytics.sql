-- ─── Credits system ──────────────────────────────────────────────────────────

-- Add credits balance column to schools (if not already there)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

-- Credit transaction log for full audit trail
CREATE TABLE IF NOT EXISTS credit_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID REFERENCES schools(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,          -- positive = added, negative = deducted
  type         TEXT NOT NULL,             -- 'analyze' | 'generate' | 'transcribe' | 'admin_add' | 'admin_deduct'
  description  TEXT,
  balance_after INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_school ON credit_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON credit_transactions(created_at DESC);

-- ─── Row-level security (keep same pattern as other tables) ──────────────────
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Service role (backend) can do everything
CREATE POLICY "service_all_credit_tx" ON credit_transactions
  USING (true) WITH CHECK (true);

-- ─── Seed: give each existing approved school 100 starter credits ─────────────
UPDATE schools SET credits = 100 WHERE status = 'approved' AND credits = 0;
