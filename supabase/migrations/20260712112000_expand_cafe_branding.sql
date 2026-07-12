-- Rename description to tagline in cafes table
ALTER TABLE public.cafes RENAME COLUMN description TO tagline;

-- Add new branding and contact columns to cafes
ALTER TABLE public.cafes ADD COLUMN phone TEXT;
ALTER TABLE public.cafes ADD COLUMN whatsapp TEXT;
ALTER TABLE public.cafes ADD COLUMN address TEXT;
ALTER TABLE public.cafes ADD COLUMN google_maps_review_url TEXT;
ALTER TABLE public.cafes ADD COLUMN website TEXT;
ALTER TABLE public.cafes ADD COLUMN instagram TEXT;
ALTER TABLE public.cafes ADD COLUMN operating_hours TEXT;

-- Add staff permission toggle to cafes
ALTER TABLE public.cafes ADD COLUMN staff_can_manage_specials BOOLEAN NOT NULL DEFAULT false;

-- Create policy to allow staff to update menu items if permission is enabled
CREATE POLICY "menu_items staff manage specials"
ON public.menu_items FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'staff', cafe_id)
  AND EXISTS (
    SELECT 1 FROM public.cafes WHERE id = cafe_id AND staff_can_manage_specials = true
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'staff', cafe_id)
  AND EXISTS (
    SELECT 1 FROM public.cafes WHERE id = cafe_id AND staff_can_manage_specials = true
  )
);
