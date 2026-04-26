-- ============================================================
-- Student Answer Sheet Analyzer — Supabase Schema
-- Run this in your Supabase project → SQL Editor
-- ============================================================

-- Tests (question papers)
CREATE TABLE IF NOT EXISTS analyzer_tests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  subject       TEXT,
  total_marks   INTEGER DEFAULT 100,
  question_paper_url     TEXT,
  question_paper_content TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Students (auto-created from answer sheets)
CREATE TABLE IF NOT EXISTS analyzer_students (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_no    TEXT NOT NULL UNIQUE,
  name       TEXT,
  class      TEXT,
  section    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Results (one row per answer sheet analyzed)
CREATE TABLE IF NOT EXISTS analyzer_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id            UUID REFERENCES analyzer_tests(id) ON DELETE CASCADE,
  student_id         UUID REFERENCES analyzer_students(id),
  original_sheet_url TEXT,
  analysis           JSONB,
  marks_obtained     NUMERIC,
  total_marks        NUMERIC,
  share_token        TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  analyzed_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────

ALTER TABLE analyzer_tests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyzer_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyzer_results  ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read everything
CREATE POLICY "auth_read_tests"    ON analyzer_tests    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_students" ON analyzer_students FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_results"  ON analyzer_results  FOR SELECT TO authenticated USING (true);

-- Public can read results (for share links — no auth needed)
CREATE POLICY "public_share_results" ON analyzer_results FOR SELECT TO anon USING (true);

-- Authenticated users can insert/update
CREATE POLICY "auth_insert_tests"    ON analyzer_tests    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert_students" ON analyzer_students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert_results"  ON analyzer_results  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_students" ON analyzer_students FOR UPDATE TO authenticated USING (true);

-- ─── Storage Buckets ─────────────────────────────────────────
-- Create these in Supabase Dashboard → Storage → New bucket:
--
--   Bucket name: question-papers   (public: YES)
--   Bucket name: answer-sheets     (public: YES)
--
-- Or run these (requires pg extension pg_net or Supabase CLI):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('question-papers', 'question-papers', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('answer-sheets', 'answer-sheets', true);

-- Storage policies (run after creating buckets)
CREATE POLICY "public_read_question_papers"
  ON storage.objects FOR SELECT USING (bucket_id = 'question-papers');

CREATE POLICY "auth_upload_question_papers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question-papers');

CREATE POLICY "public_read_answer_sheets"
  ON storage.objects FOR SELECT USING (bucket_id = 'answer-sheets');

CREATE POLICY "auth_upload_answer_sheets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'answer-sheets');

-- ─── Required environment variables ──────────────────────────
-- Backend .env:
--   ANTHROPIC_API_KEY=...
--   SUPABASE_URL=https://your-project.supabase.co
--   SUPABASE_SERVICE_KEY=...    ← service_role key (not anon)
--
-- Frontend .env (student-analyzer/):
--   VITE_API_URL=http://localhost:3001
--   VITE_SUPABASE_URL=https://your-project.supabase.co
--   VITE_SUPABASE_ANON_KEY=...
