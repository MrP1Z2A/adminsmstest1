-- SQL to create class_announcements table
CREATE TABLE IF NOT EXISTS public.class_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    class_course_id UUID REFERENCES public.class_courses(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    notice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    attachment_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.class_announcements ENABLE ROW LEVEL SECURITY;

-- Add RLS policies (adjust as needed for your project's security model)
CREATE POLICY "Enable all for authenticated users" ON public.class_announcements
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_announcements;
