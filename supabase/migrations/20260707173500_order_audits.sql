-- Create order_audits table to track modifications
CREATE TABLE IF NOT EXISTS public.order_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  editor TEXT NOT NULL CHECK (editor IN ('customer', 'staff')),
  change_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS and permissions for order_audits
ALTER TABLE public.order_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_audits public read" ON public.order_audits FOR SELECT USING (true);
CREATE POLICY "order_audits public insert" ON public.order_audits FOR INSERT WITH CHECK (true);

GRANT SELECT, INSERT ON public.order_audits TO anon, authenticated;
GRANT ALL ON public.order_audits TO service_role;

-- Enable realtime for order_audits
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_audits;
