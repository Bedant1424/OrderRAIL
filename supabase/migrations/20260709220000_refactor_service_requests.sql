-- Rename session_id to browser_session_id in service_requests
ALTER TABLE public.service_requests RENAME COLUMN session_id TO browser_session_id;

-- Add dining_session_id column referencing dining_sessions(id)
ALTER TABLE public.service_requests ADD COLUMN dining_session_id UUID REFERENCES public.dining_sessions(id) ON DELETE SET NULL;

-- Associate historical service requests with their corresponding dining sessions
UPDATE public.service_requests
SET dining_session_id = ds.id
FROM public.dining_sessions ds
WHERE public.service_requests.table_id = ds.table_id
  AND public.service_requests.created_at >= ds.opened_at
  AND (ds.closed_at IS NULL OR public.service_requests.created_at <= ds.closed_at);
