-- Create daily order sequence counter table
CREATE TABLE IF NOT EXISTS public.daily_order_counters (
    date DATE PRIMARY KEY,
    counter INTEGER NOT NULL DEFAULT 0
);

-- Alter orders table to add order_number column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number INTEGER;

-- Backfill existing orders sequentially by day (in UTC)
DO $$
DECLARE
  r RECORD;
  v_prev_date DATE := NULL;
  v_counter INTEGER := 0;
BEGIN
  FOR r IN 
    SELECT id, (created_at AT TIME ZONE 'UTC')::date as order_date 
    FROM public.orders 
    ORDER BY created_at ASC, id ASC
  LOOP
    IF v_prev_date IS NULL OR r.order_date <> v_prev_date THEN
      v_prev_date := r.order_date;
      v_counter := 1;
    ELSE
      v_counter := v_counter + 1;
    END IF;
    
    UPDATE public.orders SET order_number = v_counter WHERE id = r.id;
    
    INSERT INTO public.daily_order_counters (date, counter)
    VALUES (r.order_date, v_counter)
    ON CONFLICT (date)
    DO UPDATE SET counter = GREATEST(public.daily_order_counters.counter, EXCLUDED.counter);
  END LOOP;
END $$;

-- Set column to NOT NULL after backfilling
ALTER TABLE public.orders ALTER COLUMN order_number SET NOT NULL;

-- Create function to generate sequential order number per calendar day atomically
CREATE OR REPLACE FUNCTION public.generate_daily_order_number()
RETURNS TRIGGER AS $$
DECLARE
  v_date DATE;
BEGIN
  -- Determine the date in UTC based on created_at or default now()
  v_date := timezone('utc', COALESCE(NEW.created_at, now()))::date;

  -- Atomic increment via row-level lock on the daily_order_counters table
  INSERT INTO public.daily_order_counters (date, counter)
  VALUES (v_date, 1)
  ON CONFLICT (date)
  DO UPDATE SET counter = public.daily_order_counters.counter + 1
  RETURNING counter INTO NEW.order_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create BEFORE INSERT trigger to generate daily order number automatically
CREATE OR REPLACE TRIGGER trigger_generate_daily_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_daily_order_number();
