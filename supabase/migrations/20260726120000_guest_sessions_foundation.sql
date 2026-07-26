-- Migration: 20260726120000_guest_sessions_foundation.sql
-- Description: Guest Sessions & Secure Table Access (Sprint 9.1)

-- 1. Create guest_sessions table
CREATE TABLE IF NOT EXISTS public.guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dining_session_id UUID NOT NULL REFERENCES public.dining_sessions(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED')) DEFAULT 'ACTIVE',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  user_agent_hash TEXT,
  created_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_guest_sessions_dining_session ON public.guest_sessions(dining_session_id);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_table ON public.guest_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_status ON public.guest_sessions(status);

-- 3. Row Level Security & Grants
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_sessions public read" ON public.guest_sessions FOR SELECT USING (true);
CREATE POLICY "guest_sessions public insert" ON public.guest_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "guest_sessions public update" ON public.guest_sessions FOR UPDATE USING (true);

GRANT SELECT, INSERT, UPDATE ON public.guest_sessions TO anon, authenticated;
GRANT ALL ON public.guest_sessions TO service_role;

-- 4. Updated_at Trigger
CREATE TRIGGER trg_guest_sessions_updated
BEFORE UPDATE ON public.guest_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 5. Extend orders table with guest_session_id
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_session_id UUID REFERENCES public.guest_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_guest_session ON public.orders(guest_session_id);

-- 6. Trigger to automatically expire all guest sessions when a dining session is closed
CREATE OR REPLACE FUNCTION public.expire_guest_sessions_on_dining_session_close()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('closed', 'EXPIRED', 'expired') AND OLD.status NOT IN ('closed', 'EXPIRED', 'expired') THEN
    UPDATE public.guest_sessions
    SET status = 'EXPIRED',
        expires_at = NOW(),
        updated_at = NOW()
    WHERE dining_session_id = NEW.id
      AND status = 'ACTIVE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_expire_guest_sessions_on_dining_close ON public.dining_sessions;
CREATE TRIGGER trg_expire_guest_sessions_on_dining_close
AFTER UPDATE OF status ON public.dining_sessions
FOR EACH ROW
EXECUTE FUNCTION public.expire_guest_sessions_on_dining_session_close();

-- 7. Enable realtime for guest_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_sessions;
