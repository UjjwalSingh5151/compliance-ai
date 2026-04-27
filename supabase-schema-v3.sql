-- EduGrade v3 Migration: School-level access + Student CRM
-- Run this in Supabase SQL Editor

-- ─── Schools ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School owners and members can view" ON schools;
CREATE POLICY "School owners and members can view" ON schools
  FOR SELECT USING (
    owner_user_id = auth.uid() OR
    id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

DROP POLICY IF EXISTS "Users can create schools" ON schools;
CREATE POLICY "Users can create schools" ON schools
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- ─── School Members ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'teacher',          -- owner | teacher
  invited_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',        -- pending | accepted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, invited_email)
);

ALTER TABLE school_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view school roster" ON school_members;
CREATE POLICY "Members can view school roster" ON school_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    school_id IN (SELECT id FROM schools WHERE owner_user_id = auth.uid())
  );

-- ─── Update existing tables ───────────────────────────────────────────────────

-- Add school_id to tests
ALTER TABLE analyzer_tests ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- Add fields to students
ALTER TABLE analyzer_students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE analyzer_students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE analyzer_students ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- Unique student identity within a school (partial index — only when all 4 fields present)
DROP INDEX IF EXISTS students_school_identity;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_identity
  ON analyzer_students(school_id, roll_no, class, academic_year)
  WHERE school_id IS NOT NULL
    AND roll_no IS NOT NULL
    AND class IS NOT NULL
    AND academic_year IS NOT NULL;
