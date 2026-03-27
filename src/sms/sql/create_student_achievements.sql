-- Create student_achievements table
CREATE TABLE IF NOT EXISTS public.student_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    achievement_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.student_achievements
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.student_achievements
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.student_achievements
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.student_achievements
    FOR DELETE USING (true);

-- Add sample data (optional, but requested for connection)
-- INSERT INTO public.student_achievements (student_id, school_id, title, description, icon, color)
-- VALUES ('NODE-SAMPLE', 'YOUR_SCHOOL_ID', 'Top Scorer', 'Highest marks in Mathematics', 'Trophy', 'emerald');
