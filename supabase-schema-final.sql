-- ============================================================
-- EduGrade — Complete Schema (idempotent, safe to re-run)
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Tables
CREATE TABLE IF NOT EXISTS analyzer_tests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  subject                TEXT,
  total_marks            INTEGER DEFAULT 100,
  leniency               INTEGER DEFAULT 3,
  instructions           TEXT,
  question_paper_url     TEXT,
  question_paper_content TEXT,
  created_by             UUID REFERENCES auth.users(id),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyzer_students (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_no    TEXT NOT NULL UNIQUE,
  name       TEXT,
  class      TEXT,
  section    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyzer_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id            UUID REFERENCES analyzer_tests(id) ON DELETE CASCADE,
  student_id         UUID REFERENCES analyzer_students(id),
  original_sheet_url TEXT,
  analysis           JSONB,
  marks_obtained     NUMERIC,
  total_marks        NUMERIC,
  teacher_comments   JSONB DEFAULT '{}',
  share_token        TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  analyzed_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to existing tables if missing (safe if already present)
ALTER TABLE analyzer_tests    ADD COLUMN IF NOT EXISTS leniency     INTEGER DEFAULT 3;
ALTER TABLE analyzer_tests    ADD COLUMN IF NOT EXISTS instructions  TEXT;
ALTER TABLE analyzer_results  ADD COLUMN IF NOT EXISTS teacher_comments JSONB DEFAULT '{}';

-- Row Level Security
ALTER TABLE analyzer_tests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyzer_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyzer_results  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid "already exists" errors
DROP POLICY IF EXISTS "auth_read_tests"       ON analyzer_tests;
DROP POLICY IF EXISTS "auth_read_students"    ON analyzer_students;
DROP POLICY IF EXISTS "auth_read_results"     ON analyzer_results;
DROP POLICY IF EXISTS "public_share_results"  ON analyzer_results;
DROP POLICY IF EXISTS "auth_insert_tests"     ON analyzer_tests;
DROP POLICY IF EXISTS "auth_insert_students"  ON analyzer_students;
DROP POLICY IF EXISTS "auth_insert_results"   ON analyzer_results;
DROP POLICY IF EXISTS "auth_update_students"  ON analyzer_students;
DROP POLICY IF EXISTS "auth_update_results"   ON analyzer_results;

-- Recreate policies
CREATE POLICY "auth_read_tests"      ON analyzer_tests    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_students"   ON analyzer_students FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_results"    ON analyzer_results  FOR SELECT TO authenticated USING (true);
CREATE POLICY "public_share_results" ON analyzer_results  FOR SELECT TO anon           USING (true);
CREATE POLICY "auth_insert_tests"    ON analyzer_tests    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert_students" ON analyzer_students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert_results"  ON analyzer_results  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_students" ON analyzer_students FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_update_results"  ON analyzer_results  FOR UPDATE TO authenticated USING (true);

-- Storage policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "public_read_question_papers" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_question_papers"  ON storage.objects;
DROP POLICY IF EXISTS "public_read_answer_sheets"    ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_answer_sheets"    ON storage.objects;

CREATE POLICY "public_read_question_papers" ON storage.objects
  FOR SELECT USING (bucket_id = 'question-papers');

CREATE POLICY "auth_upload_question_papers" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'question-papers');

CREATE POLICY "public_read_answer_sheets" ON storage.objects
  FOR SELECT USING (bucket_id = 'answer-sheets');

CREATE POLICY "auth_upload_answer_sheets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'answer-sheets');
