-- ============================================================
-- Migration: Answer Sheet Storage
-- Run this in Supabase → SQL Editor
-- Safe to re-run — uses IF NOT EXISTS throughout
-- ============================================================

-- 1. Add original_sheet_url column to results (if not already there)
ALTER TABLE analyzer_results
  ADD COLUMN IF NOT EXISTS original_sheet_url TEXT;

-- 2. Storage policies for answer-sheets bucket
--    (You must CREATE the bucket manually in Supabase Dashboard → Storage first)
--    Bucket name: answer-sheets   (set to Public)

DROP POLICY IF EXISTS "public_read_answer_sheets"  ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_answer_sheets"  ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_answer_sheets"  ON storage.objects;

CREATE POLICY "public_read_answer_sheets" ON storage.objects
  FOR SELECT USING (bucket_id = 'answer-sheets');

CREATE POLICY "auth_upload_answer_sheets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'answer-sheets');

CREATE POLICY "auth_delete_answer_sheets" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'answer-sheets');

-- 3. Storage policies for question-papers bucket
--    Bucket name: question-papers  (set to Public)

DROP POLICY IF EXISTS "public_read_question_papers" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_question_papers" ON storage.objects;

CREATE POLICY "public_read_question_papers" ON storage.objects
  FOR SELECT USING (bucket_id = 'question-papers');

CREATE POLICY "auth_upload_question_papers" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'question-papers');
