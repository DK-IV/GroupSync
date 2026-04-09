-- GroupSync Database Schema (Supabase)

-- 1. Users Table (Registered Users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Note: In a real Supabase app, you might map this to auth.users using an insert trigger, 
-- but this table will serve as our public profiles.

-- 2. Events Table (Planning Sessions)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'finalized', 'archived'))
);

-- 3. Participants Table (Junction between Users/Guests and Events)
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Null if they are a guest
  guest_name TEXT,
  permission_level TEXT DEFAULT 'full_edit' CHECK (permission_level IN ('full_edit', 'suggestion', 'view_only')),
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Calendar Blocks Table (Availability Mapping)
CREATE TABLE public.calendar_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status_color TEXT NOT NULL CHECK (status_color IN ('red', 'orange', 'green')),
  custom_note TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies allowing all operations for now (for quick development).
-- IN PRODUCTION: These must be scoping down to authenticated users and event participants.
CREATE POLICY "Allow public read/write access to users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow public read/write access to events" ON public.events FOR ALL USING (true);
CREATE POLICY "Allow public read/write access to participants" ON public.participants FOR ALL USING (true);
CREATE POLICY "Allow public read/write access to calendar_blocks" ON public.calendar_blocks FOR ALL USING (true);
