-- Migration: Fix Customer Phone-Only Profile Name Fallback RPC
-- Updates resolve_or_create_customer RPC to default customer name to normalized phone number when name is omitted/empty.

CREATE OR REPLACE FUNCTION public.resolve_or_create_customer(
  p_cafe_id UUID,
  p_phone TEXT,
  p_normalized_phone TEXT,
  p_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_existing_name TEXT;
  v_effective_name TEXT;
  v_clean_name TEXT;
  v_clean_phone TEXT;
  v_norm_phone TEXT;
BEGIN
  IF p_cafe_id IS NULL OR p_normalized_phone IS NULL OR trim(p_normalized_phone) = '' THEN
    RETURN NULL;
  END IF;

  v_norm_phone := trim(p_normalized_phone);
  v_clean_phone := NULLIF(trim(p_phone), '');
  IF v_clean_phone IS NULL THEN
    v_clean_phone := v_norm_phone;
  END IF;

  v_clean_name := NULLIF(trim(p_name), '');
  -- If p_name is empty/null, default profile name to normalized phone number
  v_effective_name := COALESCE(v_clean_name, v_norm_phone);

  -- Lock existing customer row if present to prevent concurrent duplicate creation
  SELECT id, name INTO v_customer_id, v_existing_name
  FROM public.customers
  WHERE cafe_id = p_cafe_id AND normalized_phone = v_norm_phone
  FOR UPDATE;

  IF v_customer_id IS NOT NULL THEN
    -- Update name if new non-empty name is provided AND (existing name is NULL/empty OR existing name is the fallback phone number)
    IF v_clean_name IS NOT NULL AND (
      v_existing_name IS NULL OR
      trim(v_existing_name) = '' OR
      v_existing_name = v_norm_phone OR
      v_existing_name = v_clean_phone
    ) THEN
      UPDATE public.customers
      SET name = v_clean_name, updated_at = now()
      WHERE id = v_customer_id;
    END IF;
    RETURN v_customer_id;
  END IF;

  -- Insert new customer profile with ON CONFLICT safety
  INSERT INTO public.customers (
    cafe_id,
    phone,
    normalized_phone,
    name,
    created_at,
    updated_at
  )
  VALUES (
    p_cafe_id,
    v_clean_phone,
    v_norm_phone,
    v_effective_name,
    now(),
    now()
  )
  ON CONFLICT (cafe_id, normalized_phone) DO UPDATE
  SET updated_at = now()
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;
