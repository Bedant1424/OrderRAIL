-- Create dining_sessions table
CREATE TABLE IF NOT EXISTS public.dining_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'closed')) DEFAULT 'active',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_amount INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS & Grants for dining_sessions
ALTER TABLE public.dining_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dining_sessions public read" ON public.dining_sessions FOR SELECT USING (true);
CREATE POLICY "dining_sessions public insert" ON public.dining_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "dining_sessions public update" ON public.dining_sessions FOR UPDATE USING (true);

GRANT SELECT, INSERT, UPDATE ON public.dining_sessions TO anon, authenticated;
GRANT ALL ON public.dining_sessions TO service_role;

-- Add trigger for updated_at
CREATE TRIGGER trg_dining_sessions_updated BEFORE UPDATE ON public.dining_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add active_session_id and status to public.tables
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS active_session_id UUID REFERENCES public.dining_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS status TEXT NOT NULL CHECK (status IN ('free', 'occupied')) DEFAULT 'free';

-- Ensure tables can be updated by public/anon to associate session
CREATE POLICY "tables public update" ON public.tables FOR UPDATE USING (true) WITH CHECK (true);

-- Add dining_session_id to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dining_session_id UUID REFERENCES public.dining_sessions(id) ON DELETE SET NULL;

-- Enable realtime for dining_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.dining_sessions;
