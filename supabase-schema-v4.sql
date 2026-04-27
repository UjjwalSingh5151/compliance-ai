-- EduGrade v4 Migration: Student Portal — Practice Sets + Attempts
-- Run this in Supabase SQL Editor

-- Add revision notes column to results
ALTER TABLE analyzer_results ADD COLUMN IF NOT EXISTS revision_notes TEXT;

-- Practice sets (generated questions, one per result, refreshable)
CREATE TABLE IF NOT EXISTS practice_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES analyzer_results(id) ON DELETE CASCADE,
  student_id UUID REFERENCES analyzer_students(id) ON DELETE SET NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE practice_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for practice sets" ON practice_sets;
CREATE POLICY "Public read for practice sets" ON practice_sets FOR SELECT USING (true);

-- Practice attempts (each time student submits answers)
CREATE TABLE IF NOT EXISTS practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_set_id UUID NOT NULL REFERENCES practice_sets(id) ON DELETE CASCADE,
  student_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE practice_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own attempts" ON practice_attempts;
CREATE POLICY "Users can manage their own attempts" ON practice_attempts
  FOR ALL USING (student_user_id = auth.uid());
