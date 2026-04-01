-- SQL to update schema for dynamic data integration

-- 1. Add date and time columns to exams table if they don't exist
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_date DATE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_time TIME;

-- 2. Add due_date column to homework_assignments table if it doesn't exist
ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS due_date DATE;

-- 3. Create homework_submissions table
CREATE TABLE IF NOT EXISTS homework_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES homework_assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    submission_url TEXT,
    comment TEXT,
    status TEXT DEFAULT 'Active',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    school_id UUID -- For multi-tenant support if needed
);

-- Ensure columns exist and update status
ALTER TABLE homework_submissions ALTER COLUMN status SET DEFAULT 'Active';
UPDATE homework_submissions SET status = 'Active' WHERE status = 'Submitted';

-- Add labels to homework_assignments for easier display in LMS
ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS class_name TEXT;
ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS course_name TEXT;

-- BACKFILL existing homework assignments with names from classes and courses tables
UPDATE homework_assignments ha
SET 
  class_name = c.name,
  course_name = cc.name
FROM classes c, class_courses cc
WHERE ha.class_id = c.id
  AND ha.class_course_id = cc.id
  AND (ha.class_name IS NULL OR ha.course_name IS NULL);

-- Ensure columns exist (in case the table was created with an older version)
ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS submission_url TEXT;

-- 4. Enable RLS and add policies
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;

-- Recreate Policies (Table) to avoid "already exists" errors
DROP POLICY IF EXISTS "Allow public insert" ON homework_submissions;
DROP POLICY IF EXISTS "Allow public select" ON homework_submissions;
DROP POLICY IF EXISTS "Allow public update" ON homework_submissions;

CREATE POLICY "Allow public insert" ON homework_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON homework_submissions FOR SELECT USING (true);
CREATE POLICY "Allow public update" ON homework_submissions FOR UPDATE USING (true);

-- 5. Create storage bucket for homework submissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-submissions', 'homework-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage Policies (Required for file uploads)
-- Recreate Policies (Storage) to avoid "already exists" errors
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public download" ON storage.objects;

CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'homework-submissions');
CREATE POLICY "Allow public download" ON storage.objects FOR SELECT USING (bucket_id = 'homework-submissions');

-- 7. Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
