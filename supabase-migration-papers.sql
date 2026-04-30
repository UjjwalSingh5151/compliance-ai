-- ============================================================
-- Migration: Generated Papers
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Table for AI-generated / transcribed question papers
CREATE TABLE IF NOT EXISTS generated_papers (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id    UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  created_by   UUID,
  mode         TEXT NOT NULL CHECK (mode IN ('ai', 'transcribe')),
  title        TEXT NOT NULL,
  class        TEXT,
  subject      TEXT,
  board        TEXT,
  total_marks  INTEGER,
  difficulty   TEXT,
  content      JSONB NOT NULL,
  format_url   TEXT,
  source_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE generated_papers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS generated_papers_school_idx ON generated_papers(school_id);

-- 2. Storage bucket note
--    Create a bucket named "generated-papers" in Supabase Dashboard → Storage
--    Set it to Public so download links work without authentication.
