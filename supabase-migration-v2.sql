-- ============================================================
-- Migration v2 — run this in Supabase SQL Editor
-- Adds leniency, instructions, teacher_comments columns
-- ============================================================

ALTER TABLE analyzer_tests
  ADD COLUMN IF NOT EXISTS leniency    INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS instructions TEXT;

ALTER TABLE analyzer_results
  ADD COLUMN IF NOT EXISTS teacher_comments JSONB DEFAULT '{}';
