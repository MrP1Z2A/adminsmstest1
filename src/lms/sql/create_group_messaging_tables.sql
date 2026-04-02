-- ============================================================
-- Group Messaging Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create the message_groups table
CREATE TABLE IF NOT EXISTS public.message_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_by  TEXT NOT NULL,        -- user id of creator
    school_id   TEXT NOT NULL,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create the message_group_members table
CREATE TABLE IF NOT EXISTS public.message_group_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES public.message_groups(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL,
    user_role   TEXT NOT NULL,         -- 'teacher' | 'student' | 'student_service'
    user_name   TEXT NOT NULL,
    user_avatar TEXT,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_id, user_id)
);

-- 3. Add group_id column to existing messages table (nullable — DMs remain unchanged)
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.message_groups(id) ON DELETE CASCADE;

-- 4. Allow receiver_id to be nullable for group messages
ALTER TABLE public.messages
    ALTER COLUMN receiver_id DROP NOT NULL;

-- 5. Enable RLS on new tables
ALTER TABLE public.message_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_group_members ENABLE ROW LEVEL SECURITY;

-- 6. Open policies (same approach as messages table)
CREATE POLICY "Allow all access for message_groups"
    ON public.message_groups FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access for message_group_members"
    ON public.message_group_members FOR ALL USING (true) WITH CHECK (true);

-- 7. Enable Realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_group_members;
