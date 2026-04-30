-- ============================================================
-- Migration: Teacher CRM + Test metadata fields
-- Run this in Supabase → SQL Editor
-- Safe to re-run — uses IF NOT EXISTS throughout
-- ============================================================

-- 1. Create school_teachers table
CREATE TABLE IF NOT EXISTS school_teachers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id  UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  email      TEXT,
  classes    TEXT[] DEFAULT '{}',
  subjects   TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE school_teachers ENABLE ROW LEVEL SECURITY;

-- 2. Add class, section, teacher_id to analyzer_tests
ALTER TABLE analyzer_tests ADD COLUMN IF NOT EXISTS class      TEXT;
ALTER TABLE analyzer_tests ADD COLUMN IF NOT EXISTS section    TEXT;
ALTER TABLE analyzer_tests ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES school_teachers(id) ON DELETE SET NULL;

-- 3. Index for school-scoped teacher lookups
CREATE INDEX IF NOT EXISTS school_teachers_school_id_idx ON school_teachers(school_id);
