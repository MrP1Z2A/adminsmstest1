-- Create messages table for LMS messaging feature (String ID Version)
-- This version uses TEXT for IDs to support non-UUID student/teacher identifiers.
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL, -- Links to students.id, teachers.id, etc.
    receiver_id TEXT NOT NULL, -- Links to students.id, teachers.id, etc.
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ,
    school_id TEXT NOT NULL,
    
    CONSTRAINT different_users CHECK (sender_id <> receiver_id)
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Temporary policy to allow all access (since Supabase Auth is not being used yet)
CREATE POLICY "Allow all access for messaging"
    ON public.messages
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
