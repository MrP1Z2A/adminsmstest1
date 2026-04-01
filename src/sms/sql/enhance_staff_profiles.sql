-- Add phone and address columns to teachers and student_services tables
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS avatar TEXT; -- Ensure avatar exists

ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS avatar TEXT; -- Ensure avatar exists
