-- EduGrade v3 Migration: School-level access + Student CRM
-- Run this in Supabase SQL Editor

-- ─── Schools (no policy yet — school_members doesn't exist yet) ───────────────

CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School owners and members can view" ON schools;
DROP POLICY IF EXISTS "Users can create schools" ON schools;

CREATE POLICY "Users can create schools" ON schools
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- ─── School Members ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'teacher',
  invited_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
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

-- Now add the schools SELECT policy (school_members exists now)
CREATE POLICY "School owners and members can view" ON schools
  FOR SELECT USING (
    owner_user_id = auth.uid() OR
    id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid() AND status = 'accepted')
  );

-- ─── Update existing tables ───────────────────────────────────────────────────

ALTER TABLE analyzer_tests ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

ALTER TABLE analyzer_students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE analyzer_students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE analyzer_students ADD COLUMN IF NOT EXISTS academic_year TEXT;

DROP INDEX IF EXISTS students_school_identity;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_identity
  ON analyzer_students(school_id, roll_no, class, academic_year)
  WHERE school_id IS NOT NULL
    AND roll_no IS NOT NULL
    AND class IS NOT NULL
    AND academic_year IS NOT NULL;
