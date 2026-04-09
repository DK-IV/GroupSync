-- Module B: Brainstorming Hub Additions

-- 1. Table to store submitted media URLs and their unfurled metadata
CREATE TABLE public.brainstorm_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  provider_name TEXT, -- e.g., "TikTok", "YouTube"
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Table to handle preferential voting
-- Users rank ideas (1st, 2nd, 3rd...), so we use a rank_position column.
CREATE TABLE public.idea_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  idea_id UUID NOT NULL REFERENCES public.brainstorm_ideas(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  rank_position INTEGER NOT NULL CHECK (rank_position > 0),
  
  -- Prevent a participant from voting on the exact same idea twice
  UNIQUE (participant_id, idea_id), 
  
  -- Prevent a participant from giving two different ideas the exact same rank within the same event
  UNIQUE (participant_id, event_id, rank_position)
);

-- Note for Supabase: You must run this snippet in the SQL Editor to append Module B tables to your project.
-- Enable RLS
ALTER TABLE public.brainstorm_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write access to brainstorm_ideas" ON public.brainstorm_ideas FOR ALL USING (true);
CREATE POLICY "Allow public read/write access to idea_votes" ON public.idea_votes FOR ALL USING (true);
