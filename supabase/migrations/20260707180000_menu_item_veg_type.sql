-- Veg / Non-veg classification for menu items
CREATE TYPE public.veg_type AS ENUM ('veg', 'non_veg', 'unspecified');

ALTER TABLE public.menu_items
  ADD COLUMN veg_type public.veg_type NOT NULL DEFAULT 'unspecified';
