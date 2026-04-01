-- Migration: Add teacher_id to class_courses to support teacher assignment in Class Management
ALTER TABLE public.class_courses ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL;

-- Index for better performance when filtering by teacher
CREATE INDEX IF NOT EXISTS idx_class_courses_teacher_id ON public.class_courses(teacher_id);
