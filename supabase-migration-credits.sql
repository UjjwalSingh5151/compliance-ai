-- ─── Credits system ──────────────────────────────────────────────────────────

-- Add credits balance column to schools (default 0; admin adds credits manually)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

-- Audit log for every credit movement (positive = add, negative = deduct)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  amount      INTEGER     NOT NULL,
  type        TEXT        NOT NULL,   -- 'admin_add' | 'analyze' | 'generate' | 'transcribe'
  description TEXT,
  created_by  UUID,                   -- auth.users.id (admin who added, or null for system deductions)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_txn_school
  ON credit_transactions(school_id, created_at DESC);

-- ─── Atomic credit deduction (prevents race conditions) ──────────────────────
-- Returns TRUE if deduction succeeded, FALSE if balance is insufficient.
CREATE OR REPLACE FUNCTION deduct_credits(
  p_school_id   UUID,
  p_amount      INT,
  p_type        TEXT,
  p_description TEXT DEFAULT NULL
) RETURNS BOOLEAN
  LANGUAGE plpgsql AS $$
DECLARE
  current_credits INT;
BEGIN
  -- Lock the row to serialise concurrent deductions
  SELECT credits INTO current_credits FROM schools WHERE id = p_school_id FOR UPDATE;
  IF current_credits < p_amount THEN
    RETURN FALSE;
  END IF;
  UPDATE schools SET credits = credits - p_amount WHERE id = p_school_id;
  INSERT INTO credit_transactions (school_id, amount, type, description)
  VALUES (p_school_id, -p_amount, p_type, p_description);
  RETURN TRUE;
END;
$$;

-- ─── Credit addition (admin action) ──────────────────────────────────────────
-- Returns the new credit balance.
CREATE OR REPLACE FUNCTION add_credits(
  p_school_id   UUID,
  p_amount      INT,
  p_description TEXT    DEFAULT 'Admin credit add',
  p_created_by  UUID    DEFAULT NULL
) RETURNS INT
  LANGUAGE plpgsql AS $$
DECLARE
  new_balance INT;
BEGIN
  UPDATE schools SET credits = credits + p_amount WHERE id = p_school_id
    RETURNING credits INTO new_balance;
  INSERT INTO credit_transactions (school_id, amount, type, description, created_by)
  VALUES (p_school_id, p_amount, 'admin_add', p_description, p_created_by);
  RETURN new_balance;
END;
$$;
