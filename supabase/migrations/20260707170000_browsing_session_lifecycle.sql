-- Update dining_sessions status check constraint to support 'browsing'
ALTER TABLE public.dining_sessions DROP CONSTRAINT IF EXISTS dining_sessions_status_check;
ALTER TABLE public.dining_sessions ADD CONSTRAINT dining_sessions_status_check CHECK (status IN ('browsing', 'active', 'closed'));
ALTER TABLE public.dining_sessions ALTER COLUMN status SET DEFAULT 'browsing';

-- Create cleanup function for expired browsing sessions (10-15 minutes timeout, we will use 15 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_expired_browsing_sessions()
RETURNS VOID AS $$
BEGIN
  -- Set table's active_session_id to NULL if its active session is browsing and older than 15 minutes
  UPDATE public.tables
  SET active_session_id = NULL,
      status = 'free'
  WHERE active_session_id IN (
    SELECT id FROM public.dining_sessions
    WHERE status = 'browsing'
      AND opened_at < now() - INTERVAL '15 minutes'
  );

  -- Close those browsing sessions
  UPDATE public.dining_sessions
  SET status = 'closed',
      closed_at = now()
  WHERE status = 'browsing'
    AND opened_at < now() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_browsing_sessions() TO anon, authenticated;
