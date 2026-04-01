-- Join table for many-to-many relationship between class_courses and teachers
CREATE TABLE IF NOT EXISTS public.class_course_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  class_course_id UUID NOT NULL REFERENCES public.class_courses(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_course_id, teacher_id) -- Prevent duplicate assignments
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_class_course_teachers_class_course_id ON public.class_course_teachers(class_course_id);
CREATE INDEX IF NOT EXISTS idx_class_course_teachers_teacher_id ON public.class_course_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_course_teachers_school_id ON public.class_course_teachers(school_id);
