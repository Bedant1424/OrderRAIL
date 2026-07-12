-- Migration to enforce menu label management restrictions for staff roles.
-- Owner can manage: Best Seller, Chef's Choice, Today's Special, New.
-- Staff can ONLY manage: Today's Special (if staff_can_manage_specials is enabled).
-- Staff cannot edit other menu item columns or add/remove other tags.

CREATE OR REPLACE FUNCTION public.verify_staff_menu_edit_permissions()
RETURNS TRIGGER AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_is_staff BOOLEAN;
  v_old_tags TEXT[];
  v_new_tags TEXT[];
  v_tag TEXT;
BEGIN
  -- If not authenticated, do not enforce (e.g. system migrations or seed scripts)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check roles using the has_role helper
  v_is_owner := public.has_role(auth.uid(), 'owner', NEW.cafe_id);
  v_is_staff := public.has_role(auth.uid(), 'staff', NEW.cafe_id);

  -- If the actor is staff but not owner, enforce restrictions
  IF v_is_staff AND NOT v_is_owner THEN
    -- 1. Ensure staff cannot edit other fields
    IF NEW.name IS DISTINCT FROM OLD.name OR
       NEW.price_cents IS DISTINCT FROM OLD.price_cents OR
       NEW.description IS DISTINCT FROM OLD.description OR
       NEW.category_id IS DISTINCT FROM OLD.category_id OR
       NEW.is_available IS DISTINCT FROM OLD.is_available OR
       NEW.image_url IS DISTINCT FROM OLD.image_url OR
       NEW.sort_order IS DISTINCT FROM OLD.sort_order OR
       NEW.veg_type IS DISTINCT FROM OLD.veg_type OR
       NEW.station IS DISTINCT FROM OLD.station OR
       NEW.base_prep_time_minutes IS DISTINCT FROM OLD.base_prep_time_minutes THEN
      RAISE EXCEPTION 'Staff are not authorized to edit menu item fields other than specials.';
    END IF;

    -- 2. Validate tags modifications
    v_old_tags := COALESCE(OLD.tags, ARRAY[]::TEXT[]);
    v_new_tags := COALESCE(NEW.tags, ARRAY[]::TEXT[]);

    -- Ensure staff did not add/remove 'Best Seller', 'Chef''s Choice', 'New'
    FOREACH v_tag IN ARRAY ARRAY['Best Seller', 'Chef''s Choice', 'New'] LOOP
      IF (v_tag = ANY(v_old_tags)) != (v_tag = ANY(v_new_tags)) THEN
        RAISE EXCEPTION 'Staff are not authorized to modify the label "%".', v_tag;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_verify_staff_menu_edit_permissions ON public.menu_items;

CREATE TRIGGER trigger_verify_staff_menu_edit_permissions
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.verify_staff_menu_edit_permissions();
