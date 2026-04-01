-- Create the student_achievements table
CREATE TABLE IF NOT EXISTS public.student_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    color TEXT DEFAULT 'text-emerald-600',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

-- Create policies for multi-tenant isolation
CREATE POLICY "Enable read access for users based on school_id" 
ON public.student_achievements FOR SELECT 
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE school_id = student_achievements.school_id
  )
);

CREATE POLICY "Enable insert for users based on school_id" 
ON public.student_achievements FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE school_id = student_achievements.school_id
  )
);

CREATE POLICY "Enable update for users based on school_id" 
ON public.student_achievements FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE school_id = student_achievements.school_id
  )
);

CREATE POLICY "Enable delete for users based on school_id" 
ON public.student_achievements FOR DELETE 
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles WHERE school_id = student_achievements.school_id
  )
);

-- Create an index to optimize queries
CREATE INDEX IF NOT EXISTS student_achievements_school_id_idx ON public.student_achievements (school_id);
CREATE INDEX IF NOT EXISTS student_achievements_student_id_idx ON public.student_achievements (student_id);
