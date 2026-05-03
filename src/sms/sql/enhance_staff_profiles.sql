-- Add phone and address columns to teachers and student_services tables
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS avatar TEXT; -- Ensure avatar exists
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS nrc TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS race TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS religion TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2);
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS job_position TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS educational_background TEXT;

ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS avatar TEXT; -- Ensure avatar exists
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS nrc TEXT;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS race TEXT;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS religion TEXT;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2);
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS job_position TEXT;
ALTER TABLE public.student_services ADD COLUMN IF NOT EXISTS educational_background TEXT;
