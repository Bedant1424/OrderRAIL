-- Migration: Provision Cheese Corner Database
-- Description: Idempotent initialization of Cheese Corner cafe, categories, items, and tables.
-- Date: 2026-08-07

-- 1. Provision Cafe
INSERT INTO public.cafes (id, name, slug, tagline, currency)
VALUES (
  '7a81ca36-39a5-4425-a348-9ce59d4dff8b',
  'Cheese Corner',
  'cheesecorner',
  'Canonical Cheese Corner Café',
  'INR'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  currency = EXCLUDED.currency,
  updated_at = now();

-- 2. Provision Categories
INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('f8db9cfc-980d-452a-adb2-da67aa7d397c', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Burger', 0)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('94917059-a6fc-40a2-a70b-1bef8160a8a8', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Fries', 1)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('0de15fe9-5f24-4519-a357-17dfc652cef9', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Pizza', 2)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('626a1ec4-dc36-4a57-a3ef-ac4c635daec8', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Pasta', 3)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('dc96bee9-ac27-4d25-acbb-147f8c805339', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Sandwich', 4)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('fb2174d2-1abe-406b-a4d2-541c2584e0b5', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Kulhad', 5)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('e20669c1-8b97-4e3c-a177-3761c1a1a418', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Garlic Bread', 6)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('1d046cf3-9e7a-4579-ab11-7ffaceb9d00a', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Wrap', 7)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('e8bef978-2393-4723-af57-f7ca1c90b65d', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Nachos', 8)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('f18db303-bab9-4979-a795-a8f8e0b8bea1', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Momos', 9)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('e1917f4b-b9c1-4a6f-a94c-c479733a91b2', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Maggi', 10)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('107c37d9-aefe-461c-a7d8-19900c8eeb3d', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Shakes', 11)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('08f2a750-17d6-428b-ac6c-0711f3d701da', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Mojito', 12)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('c0fb2878-fbae-4033-a3d8-f827efd220c3', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Beverages', 13)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('ab5d8f0b-f4e1-4a6f-a3c8-cd9d92ba82f1', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Dessert', 14)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_categories (id, cafe_id, name, sort_order)
VALUES ('29a90d88-3caf-41cc-ac7f-961d3904ccf9', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), 'Meal Combos', 15)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

-- 3. Provision Menu Items
INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '62c664ef-cb77-4e08-a496-e20794adef97',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f8db9cfc-980d-452a-adb2-da67aa7d397c',
  'Garden Fresh Burger',
  'Crisp veg patty layered with fresh lettuce, sliced tomatoes, onions, and creamy mayo in a toasted sesame bun.',
  5900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/garden-fresh-burger.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'd3a31006-88cf-4fc7-ab68-85378a2d38ec',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f8db9cfc-980d-452a-adb2-da67aa7d397c',
  'New York Yankee Burger',
  'Classic american style potato patty topped with tangy gherkins, yellow cheddar cheese sauce, crisp onions, and mustard mayo.',
  6900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/new-york-yankee-burger.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'b1f6793d-3a37-47b8-a7bc-a11f6f9c190b',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f8db9cfc-980d-452a-adb2-da67aa7d397c',
  'Spicy Salsa Burger',
  'Crunchy spiced vegetable patty drizzled with fiery Mexican salsa, jalapeno slices, shredded lettuce, and chipotle mayonnaise.',
  8900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/spicy-salsa-burger.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'f2e67f9c-f8c9-4ef7-addb-e0c0870c1476',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f8db9cfc-980d-452a-adb2-da67aa7d397c',
  'Double Decker Burger',
  'Two crispy vegetable patties stacked high with double cheese, fresh tomato, crisp onion rings, and signature house sauce.',
  9900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/double-decker-burger.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'acc59c81-b5c5-4762-a7f3-c42637614941',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f8db9cfc-980d-452a-adb2-da67aa7d397c',
  'Corn Cheese Burger',
  'Golden sweet corn patty blended with melted cheese, topped with garlic mayo, fresh lettuce, and soft toasted buns.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/corn-cheese-burger.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  4
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '58943056-e28b-4e98-ae69-4b21cf68db9a',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f8db9cfc-980d-452a-adb2-da67aa7d397c',
  'Sizzling Burger',
  'Grilled spiced patty tossed in chef''s special sizzling pepper sauce, loaded with melted mozzarella, sautéed onions, and lettuce.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/sizzling-burger.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['house-special']::TEXT[],
  5
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'cf8774b3-579c-4253-a58a-a8ba09fc2801',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f8db9cfc-980d-452a-adb2-da67aa7d397c',
  'Creamy Mushroom Burger',
  'Sautéed garlic button mushrooms folded into a savory vegetable patty, finished with rich mushroom cream sauce and lettuce.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/creamy-mushroom-burger.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  6
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'ac29d674-743a-49f0-a75a-4bc43e7b0105',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f8db9cfc-980d-452a-adb2-da67aa7d397c',
  'Paneer Delight Burger',
  'Thick slab of spiced grilled paneer coated in tikka marinade, topped with mint mayo, crisp onions, and tomatoes.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/paneer-delight-burger.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  7
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'b4ddf800-cec6-48d0-acd3-044ad4b04462',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '94917059-a6fc-40a2-a70b-1bef8160a8a8',
  'French Fries',
  'Golden, crispy potato fries lightly salted and served piping hot with classic tomato ketchup and garlic dip.',
  7900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/french-fries.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '2264bbc6-5386-4e3b-ac90-af1266f2bac0',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '94917059-a6fc-40a2-a70b-1bef8160a8a8',
  'Piri Piri Fries',
  'Crispy crinkle-cut fries tossed generously in zesty African piri piri spice mix for a tangy chili kick.',
  9900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/piri-piri-fries.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'e84c173e-520b-4504-a58a-0ae23736e728',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '94917059-a6fc-40a2-a70b-1bef8160a8a8',
  'Cheese Masala Fries',
  'Hot potato fries tossed in Indian chaat spices and smothered with warm, gooey melted cheese sauce.',
  9900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cheese-masala-fries.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '5d9f842f-ccca-4711-a2ab-75d6e2f93a99',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '94917059-a6fc-40a2-a70b-1bef8160a8a8',
  'Exotic Fries',
  'Golden fries loaded with melted mozzarella, sliced jalapenos, black olives, sweet corn, and special herb seasoning.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/exotic-fries.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['best-seller']::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'fcc07aff-1326-429a-a123-d7080fa18e76',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '94917059-a6fc-40a2-a70b-1bef8160a8a8',
  'BBQ Cheese Fries',
  'Crunchy fries layered with smoky barbecue sauce, rich melted cheese blend, spring onions, and cracked black pepper.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/bbq-cheese-fries.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  4
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '00f11785-601f-4b16-a21e-3d829c7a49ef',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '94917059-a6fc-40a2-a70b-1bef8160a8a8',
  'Cheese Chilli Fries',
  'Spicy potato fries topped with crushed red chilies, green chili slices, and melted orange cheddar cheese sauce.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cheese-chilli-fries.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  5
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '84d57129-ff4d-4f36-a892-6252efb36e34',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '94917059-a6fc-40a2-a70b-1bef8160a8a8',
  'Salsa Cheese Fries',
  'Thick cut fries covered in tangy tomato salsa, melted cheese sauce, chopped cilantro, and savory Mexican spices.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/salsa-cheese-fries.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  6
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '1ea59dde-f9a5-4a4f-ab05-b3e9de8ebc16',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Margherita',
  'Traditional Italian pizza baked with fresh tomato sauce, rich mozzarella cheese, basil leaves, and olive oil drizzle.',
  9900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/margherita.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '77bb8263-3997-49f9-ad1e-b3c06fd292fd',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Sweet Corn Delight',
  'Kid friendly pizza topped with juicy sweet corn kernels, mild tomato sauce, and a generous layer of mozzarella.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/sweet-corn-delight.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'fc24aedf-cc84-412b-a720-65163d912c34',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Latino Heat',
  'Fiery pizza loaded with spicy salsa sauce, sliced jalapenos, red chili flakes, capsicum, and melted mozzarella cheese.',
  14900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/latino-heat.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'f0d6a324-77bd-42bd-a1d6-871de7792b15',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Exotic Italian',
  'Premium pizza topped with black olives, jalapenos, sliced mushrooms, capsicum, sweet corn, and Italian herb seasoning.',
  14900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/exotic-italian.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['best-seller']::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'e0f50e03-f6f3-4537-a496-61cad2f2a30e',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Paneer Maharaja Pizza',
  'Royal pizza topped with marinated paneer cubes, diced capsicum, red onions, sweet corn, and rich mozzarella cheese.',
  16900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/paneer-maharaja-pizza.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  4
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'b39b8bdc-224d-422e-a094-7bc62a4eeb40',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Wild Mushroom Pizza',
  'Earthy pizza loaded with sliced button mushrooms, garlic butter drizzle, aromatic herbs, and melted mozzarella cheese.',
  16900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/wild-mushroom-pizza.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  5
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'dfbf2043-c6a0-4179-a1e2-45b0ea5af67d',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Create Your Own Pizza',
  'Customize your pizza with your choice of any four fresh toppings including paneer, corn, mushrooms, olives, and peppers.',
  16900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/create-your-own-pizza.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  6
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'e7ddbde8-deb2-40de-abcf-ea173eb26c5f',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Cheese Bliss Pizza',
  'Irresistible pizza featuring a blend of mozzarella, cheddar, and cheese sauce baked to golden melted perfection.',
  17900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cheese-bliss-pizza.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  7
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'aa968d12-158c-4ebb-afe7-f7ea50951f8c',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Four Cheese Pizza',
  'Decadent pizza featuring a blend of mozzarella, cheddar, processed cheese, and cheese sauce with Italian herbs.',
  18900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/four-cheese-pizza.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  8
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'ea7fe805-dc4d-4667-a43e-7d1e8a9ed1e9',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Mix Italian Pizza',
  'Flavorful pizza loaded with capsicum, red paprika, baby corn, black olives, mozzarella, and house pizza sauce.',
  19900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/mix-italian-pizza.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  9
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'a84924ab-faac-4367-a7e0-b4c1002a1e8e',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Quattro Formaggi',
  'Gourmet four cheese pizza with rich mozzarella, sharp cheddar, cream cheese, and oregano on a crispy crust.',
  21900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/quattro-formaggi.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  10
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'f04d558d-234b-4b88-a0f0-4197d0eb30a7',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '0de15fe9-5f24-4519-a357-17dfc652cef9',
  'Royal Paneer Pizza',
  'Loaded pizza featuring tandoori spiced paneer cubes, crisp capsicum, onions, mozzarella, and spicy makhani sauce.',
  20900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/royal-paneer-pizza.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  11
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '1c6b1858-d2ee-48e7-a92d-3a9373a7a560',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '626a1ec4-dc36-4a57-a3ef-ac4c635daec8',
  'Alfredo',
  'Penne pasta tossed in a rich, velvety garlic parmesan cream sauce with sautéed herbs and black pepper.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/alfredo.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '828731c3-1bef-4a32-ad62-554340dc3f18',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '626a1ec4-dc36-4a57-a3ef-ac4c635daec8',
  'Arrabbiata',
  'Classic penne pasta cooked in a fiery Italian tomato sauce infused with garlic, red chilies, and fresh basil.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/arrabbiata.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '0e882830-a45e-43ce-a8e0-b4ee27940a48',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '626a1ec4-dc36-4a57-a3ef-ac4c635daec8',
  'Pink Delight',
  'Penne pasta cooked in a harmonious blend of creamy alfredo and tangy arrabbiata sauce with garden vegetables.',
  14900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/pink-delight.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['best-seller']::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '8a8bcec1-6ddd-49fc-a9d4-add7259392b0',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '626a1ec4-dc36-4a57-a3ef-ac4c635daec8',
  'Mac & Cheese',
  'Classic elbow macaroni coated in a smooth, gooey cheddar cheese sauce, baked with a golden cheese crust.',
  15900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/mac-cheese.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '633179c3-3f33-4333-a80b-162e1e85e9e6',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'dc96bee9-ac27-4d25-acbb-147f8c805339',
  'Classic Vegetable Sandwich',
  'Fresh white bread layered with sliced cucumber, tomato, onion, capsicum, mint chutney, and butter.',
  8900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/classic-vegetable-sandwich.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '9e828f28-bb81-4149-ad8e-7fcb26a18a12',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'dc96bee9-ac27-4d25-acbb-147f8c805339',
  'Nutella Sandwich',
  'Soft white bread generously spread with rich hazelnut Nutella, served fresh as a sweet café treat.',
  10900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/nutella-sandwich.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'f6cb9327-67a2-48b3-a865-dee87925dd36',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'dc96bee9-ac27-4d25-acbb-147f8c805339',
  'Cheese Chilli Sandwich',
  'Grilled bread stuffed with spicy chili garlic paste, chopped green chilies, and gooey melted mozzarella cheese.',
  11900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cheese-chilli-sandwich.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '845c40f7-8b99-4bed-a598-53c81d7b3686',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'dc96bee9-ac27-4d25-acbb-147f8c805339',
  'Veg Grilled Cheese Sandwich',
  'Toasted sandwich packed with crisp garden vegetables, house spices, and melted cheese, grilled to crispy perfection.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/veg-grilled-cheese-sandwich.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '2bc09a78-994e-49b8-a369-106c6b2a64f7',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'dc96bee9-ac27-4d25-acbb-147f8c805339',
  'Corn Cheese Sandwich',
  'Golden toasted sandwich stuffed with sweet corn kernels, creamy mayo, herb seasoning, and melted cheddar cheese.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/corn-cheese-sandwich.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  4
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'edfea3fa-7e58-4a7c-a8dd-c447f7d615d2',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'dc96bee9-ac27-4d25-acbb-147f8c805339',
  'Paneer Tikka Sandwich',
  'Grilled sandwich loaded with tandoori marinated paneer cubes, sliced onions, capsicum, and tangy mint mayo.',
  14900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/paneer-tikka-sandwich.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  5
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'f8dfed40-9b38-421a-aefc-2b3a59f1032c',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'dc96bee9-ac27-4d25-acbb-147f8c805339',
  'Cheesy Creamy Mushroom',
  'Crispy grilled sandwich filled with garlic sautéed button mushrooms, white cream sauce, and gooey melted mozzarella.',
  14900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cheesy-creamy-mushroom.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  6
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'c47e0521-6859-4843-a25d-e5b3df575ec9',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'dc96bee9-ac27-4d25-acbb-147f8c805339',
  'Junglee Sandwich',
  'Ultimate grilled sandwich loaded with spiced potatoes, paneer, veggies, green chutney, and double layers of melted cheese.',
  17900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/junglee-sandwich.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  7
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '5c1c239b-7979-408c-ae96-22e16b0485c5',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'fb2174d2-1abe-406b-a4d2-541c2584e0b5',
  'Clay Pot Pizza',
  'Kulhad Pizza is a mini pizza served in a clay cup, with a crispy crust, melted cheese, spicy pizza sauce, and toppings.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/clay-pot-pizza.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '10b848f8-e75a-4d78-a700-e665ad0bcd5f',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'fb2174d2-1abe-406b-a4d2-541c2584e0b5',
  'Kulhad Maggi Mania',
  'Kulhad Maggi is a unique version of Maggi served in a traditional clay cup, featuring flavorful Maggi rich spices, and aromatic broth.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/kulhad-maggi-mania.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '2be17abd-d159-4826-a991-198755f3b01d',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'fb2174d2-1abe-406b-a4d2-541c2584e0b5',
  'Kulhad Dumplings',
  'Kulhad Momo is a mini Momo served in a traditional clay cup, with a crispy crust, melted cheese, tangy sauce, and toppings.',
  15900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/kulhad-dumplings.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['best-seller']::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '414f79f7-250e-4b4e-aefe-2f922a0a041a',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e20669c1-8b97-4e3c-a177-3761c1a1a418',
  'Cheese Garlic Bread',
  'Cheese Garlic Bread is toasted bread topped with a buttery garlic spread and melted cheese, offering a savory, crispy treat.',
  8900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cheese-garlic-bread.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '4cab042e-8235-4bd4-a84c-7f0b22243fe9',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e20669c1-8b97-4e3c-a177-3761c1a1a418',
  'Supreme Treat Garlic Bread',
  'Garlic bread toasted with sweet corn, sliced jalapenos, onions, mozzarella cheese, and zesty Italian seasoning.',
  10900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/supreme-treat-garlic-bread.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'a27ce34f-a8d5-49ac-a586-3e0d33a94f6a',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e20669c1-8b97-4e3c-a177-3761c1a1a418',
  'Crispy Garlic Delight',
  'Thin Crust Garlic Bread Features A Crispy, Golden Crust Topped With Buttery Garlic, Herbs, And A Hint Of Cheese.',
  11900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/crispy-garlic-delight.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'fa4a7250-e5b5-432e-a4ab-e7615e239fb2',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e20669c1-8b97-4e3c-a177-3761c1a1a418',
  'Cheese Pull & Tear Garlic Bun',
  'Soft baked bun stuffed with warm garlic butter, orange cheese sauce, herbs, and gooey pull-apart mozzarella cheese.',
  14900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cheese-pull-tear-garlic-bun.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '309c6050-9790-4725-a6ba-72a8df1ae923',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '1d046cf3-9e7a-4579-ab11-7ffaceb9d00a',
  'Cheese Delight Wrap',
  'The Cheesy Delight Wrap is a warm tortilla filled with gooey melted cheese, fresh veggies, and savory seasonings for a quick treat.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cheese-delight-wrap.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'bd9b38f4-2f2f-4df1-af66-c0ab93f6554e',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '1d046cf3-9e7a-4579-ab11-7ffaceb9d00a',
  'Corn & Cheese Wrap',
  'The Corn & Cheese Wrap features a soft tortilla filled with sweet corn, melted cheese, and savory seasonings, offering a delicious bite.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/corn-cheese-wrap.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['best-seller']::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '39d238d2-f780-4058-a30d-115353945569',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '1d046cf3-9e7a-4579-ab11-7ffaceb9d00a',
  'Creamy Mushroom Wrap',
  'Tortilla wrap filled with garlic sautéed mushrooms, creamy white sauce, fresh lettuce, and mild spices.',
  14900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/creamy-mushroom-wrap.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '1c91cb0d-1fac-4dd3-a134-eb35289c9228',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '1d046cf3-9e7a-4579-ab11-7ffaceb9d00a',
  'BBQ Paneer Wrap',
  'The BBQ Paneer Wrap features tender paneer chunks coated in spicy BBQ sauce, wrapped with fresh veggies in a soft tortilla.',
  15900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/bbq-paneer-wrap.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'd32136c1-124c-4c7a-a58a-ea9e2614be0f',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e8bef978-2393-4723-af57-f7ca1c90b65d',
  'Nachos With Cheese Dip',
  'Crispy Nachos Chips served with orange cheese sauce and a side bowl of warm cheddar dip.',
  7900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/nachos-with-cheese-dip.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'b0ec358d-71a8-4bda-ac11-486ae0f4d6e9',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e8bef978-2393-4723-af57-f7ca1c90b65d',
  'Nachos & Salsa',
  'Nachos & Salsa are crispy tortilla chips paired with tangy, fresh tomato salsa, offering a delicious balance of crunch and zest.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/nachos-salsa.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '2f56a9d8-6879-4fe9-a12a-ce79852b51e6',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e8bef978-2393-4723-af57-f7ca1c90b65d',
  'Exotic Nachos',
  'Crunchy Nachos With Loaded Zorko Special Sauce Cheese Olives and Jalapeno, baked to golden perfection.',
  14900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/exotic-nachos.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['best-seller']::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '93ddc68d-3df0-480f-a0a4-097e64663682',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f18db303-bab9-4979-a795-a8f8e0b8bea1',
  'Steam Momos',
  'Classic Tibetan style dumplings filled with finely chopped spiced vegetables, steamed tender and served with red chili chutney.',
  7900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/steam-momos.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '63983ca3-0ebc-42ac-aa37-efdf46da07c1',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f18db303-bab9-4979-a795-a8f8e0b8bea1',
  'Fried Momos',
  'Crispy golden vegetable dumplings fried to perfection, served piping hot with fiery chili garlic dipping sauce.',
  7900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/fried-momos.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '990a9971-2a7a-4f25-a465-dc145075260d',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f18db303-bab9-4979-a795-a8f8e0b8bea1',
  'Kurkure Momos',
  'Crunchy crusted vegetable momos coated in crunchy cornflake batter, fried golden and served with spicy mayo.',
  9900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/kurkure-momos.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '4a137b9f-466a-417f-a7ff-5be7f3be96b3',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f18db303-bab9-4979-a795-a8f8e0b8bea1',
  'BBQ Momos',
  'Fried vegetable dumplings tossed in smoky barbecue glaze, sprinkled with sesame seeds and spring onions.',
  11900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/bbq-momos.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'ea8bd3a4-d939-4092-a3a4-2427c144c32c',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'f18db303-bab9-4979-a795-a8f8e0b8bea1',
  'Creamy Alfredo Momos',
  'Steamed vegetable momos smothered in a rich, garlic-infused white alfredo cream sauce with herbs.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/creamy-alfredo-momos.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  4
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'b254ab72-cdd6-410c-a574-f3e7033c3a2f',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e1917f4b-b9c1-4a6f-a94c-c479733a91b2',
  'Cheesy Soupy Maggi',
  'Comforting bowl of hot soupy Maggi noodles topped with a slice of melted cheddar cheese.',
  7900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cheesy-soupy-maggi.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '4b436052-db25-4a32-a256-7f40d43e3c7b',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e1917f4b-b9c1-4a6f-a94c-c479733a91b2',
  'Double Masala Maggi',
  'Classic Maggi noodles cooked with an extra punch of Indian spices, green chilies, and fresh coriander.',
  8900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/double-masala-maggi.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '08cc538f-ebe0-4e70-a28c-b92031da7812',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e1917f4b-b9c1-4a6f-a94c-c479733a91b2',
  'Cheddar Cheese Maggi',
  'Maggi noodles cooked with mild spices and mixed with rich cheddar cheese sauce for a creamy finish.',
  9900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cheddar-cheese-maggi.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '37b48fb7-8d7c-4c8b-a145-4d27899e5309',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e1917f4b-b9c1-4a6f-a94c-c479733a91b2',
  'Fried Maggi',
  'Pan fried Maggi noodles tossed with crisp onions, capsicum, green peas, and tangy Indian spices.',
  9900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/fried-maggi.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '9a259434-31e3-4085-a72e-5a58c50c345b',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'e1917f4b-b9c1-4a6f-a94c-c479733a91b2',
  'Maggi Trois Delices',
  'Specialty Maggi noodles cooked with sweet corn, green peas, paneer cubes, butter, and secret aromatic spices.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/maggi-trois-delices.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  4
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'c40c7bbf-2bd6-4b98-a1ed-806b57c2e0e0',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '107c37d9-aefe-461c-a7d8-19900c8eeb3d',
  'Rose Delight Shake',
  'Chilled milk blended with fragrant rose syrup, vanilla ice cream, and topped with rose petals.',
  7900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/rose-delight-shake.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '63c23fa2-c971-443f-affd-f363fb18dbdf',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '107c37d9-aefe-461c-a7d8-19900c8eeb3d',
  'Surti Cold Coco',
  'Traditional Gujarati thick chocolate milk drink served chilled, topped with grated dark chocolate and cocoa powder.',
  8900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/surti-cold-coco.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['best-seller']::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '0b871596-1158-4ec5-af43-a90ec37165a9',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '107c37d9-aefe-461c-a7d8-19900c8eeb3d',
  'Cookie & Cream Shake',
  'Thick creamy milkshake blended with crunchy chocolate Oreo cookies, topped with whipped cream and cookie crumbs.',
  10900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cookie-cream-shake.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'ffd06356-9962-49e7-a2c9-7a30fe4dc514',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '107c37d9-aefe-461c-a7d8-19900c8eeb3d',
  'Chocolate Shake',
  'Classic rich chocolate milkshake made with cocoa, milk, and chocolate ice cream, served chilled.',
  10900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/chocolate-shake.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '89d803ab-f532-4959-af00-1acc01163bf6',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '107c37d9-aefe-461c-a7d8-19900c8eeb3d',
  'Strawberry Shake',
  'Refreshing milkshake blended with real strawberry syrup, cold milk, and smooth vanilla ice cream.',
  10900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/strawberry-shake.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  4
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '3c8bef1a-9c76-4f56-af5c-6219e3777b4b',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '107c37d9-aefe-461c-a7d8-19900c8eeb3d',
  'Kit Kat Shake',
  'Decadent milkshake blended with crunchy Kit Kat chocolate bars, chocolate syrup, and vanilla ice cream.',
  11900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/kit-kat-shake.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  5
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'c7b907f2-9c62-43f3-acc0-2b45cd75c586',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '107c37d9-aefe-461c-a7d8-19900c8eeb3d',
  'Brownie Blast Shake',
  'Thick chocolate shake blended with rich fudgy chocolate brownie chunks, topped with chocolate drizzle.',
  12900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/brownie-blast-shake.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  6
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '5002ba09-7d2a-4ccf-ad1a-56f09fa72f38',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '107c37d9-aefe-461c-a7d8-19900c8eeb3d',
  'Nutella Shake',
  'Creamy milkshake blended with authentic hazelnut Nutella spread, cold milk, and rich chocolate ice cream.',
  13900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/nutella-shake.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  7
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '198d9324-32bc-4941-aa26-62220daf6453',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '08f2a750-17d6-428b-ac6c-0711f3d701da',
  'Berry Mojito',
  'Sparkling mocktail infused with mixed berry syrup, fresh mint leaves, lime juice, and soda over ice.',
  6900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/berry-mojito.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['best-seller']::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '3ca6c229-efb5-442d-a440-d52a6426b8a9',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '08f2a750-17d6-428b-ac6c-0711f3d701da',
  'Spicy Guava Mojito',
  'Zesty guava mocktail stirred with pink guava juice, fresh mint, lime, soda, and a pinch of chili salt.',
  5900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/spicy-guava-mojito.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '96ea9a5b-10c4-465f-a747-a2e8852bc340',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '08f2a750-17d6-428b-ac6c-0711f3d701da',
  'Strawberry Mojito',
  'Cooling summer drink made with sweet strawberry puree, crushed mint leaves, lime juice, and sparkling soda.',
  5900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/strawberry-mojito.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '3da7139a-5d07-4bcf-a350-62a4f67def29',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '08f2a750-17d6-428b-ac6c-0711f3d701da',
  'Mango Mojito',
  'Tropical mocktail blending sweet mango pulp, fresh mint leaves, tangy lime juice, and chilled soda.',
  5900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/mango-mojito.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '1dac205d-9140-4450-a7b1-bd8d6adce1ec',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '08f2a750-17d6-428b-ac6c-0711f3d701da',
  'Pine Mojito',
  'Refreshing pineapple mocktail mixed with sweet pineapple juice, mint leaves, lime, and bubbly soda.',
  5900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/pine-mojito.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  4
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'a16b455c-4c17-4392-a0ee-5ea7252cf9fc',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '08f2a750-17d6-428b-ac6c-0711f3d701da',
  'Lychee Mojito',
  'Exotic cooling mocktail made with sweet lychee juice, muddled mint, lime, and chilled sparkling soda water.',
  5900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/lychee-mojito.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  5
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'c453c6e3-c576-4095-a690-886dcf057e5d',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '08f2a750-17d6-428b-ac6c-0711f3d701da',
  'Orange Sunset Mojito',
  'Vibrant mocktail combining fresh orange juice, grenadine syrup, muddled mint leaves, lime, and sparkling soda.',
  5900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/orange-sunset-mojito.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  6
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '7484b31e-454e-44e6-a7d2-b0b45ec6fca1',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '08f2a750-17d6-428b-ac6c-0711f3d701da',
  'Blue Ocean Mojito',
  'Electric blue ocean mocktail made with blue curaçao syrup, fresh mint, lime juice, and fizzing soda.',
  5900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/blue-ocean-mojito.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  7
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'e0497705-a9d4-444e-ad1e-ba453e640dbd',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '08f2a750-17d6-428b-ac6c-0711f3d701da',
  'Mint Mojito',
  'Classic virgin mint mojito made with freshly muddled mint leaves, lime wedges, sugar, and sparkling soda.',
  5900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/mint-mojito.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  8
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '91182044-4641-441d-a072-fa5b99ba5b4f',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '08f2a750-17d6-428b-ac6c-0711f3d701da',
  'Rose Mojito',
  'Fragrant rose mocktail crafted with rose syrup, fresh mint leaves, lime juice, and chilled soda over ice.',
  7900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/rose-mojito.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  9
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '537c33b7-e9ec-4613-a0e0-9327249f2721',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'c0fb2878-fbae-4033-a3d8-f827efd220c3',
  'Masala Tea',
  'Traditional Indian hot milk tea simmered with aromatic ginger, cardamom, cloves, and tea leaves.',
  1900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/masala-tea.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'af444d60-104b-4307-aeb5-1dd2d364d012',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'c0fb2878-fbae-4033-a3d8-f827efd220c3',
  'Hot Coffee',
  'Freshly brewed hot milk coffee prepared with fine roasted coffee beans, warm milk, and sugar.',
  2900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/hot-coffee.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '11849b22-5f63-44dc-aef9-635878ea0ea5',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'c0fb2878-fbae-4033-a3d8-f827efd220c3',
  'Hot Chocolate',
  'Rich, velvety hot chocolate made with melted dark cocoa, steaming milk, and a dusting of cocoa.',
  4900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/hot-chocolate.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '85b21667-738c-4131-a887-259846161955',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'c0fb2878-fbae-4033-a3d8-f827efd220c3',
  'Cold Coffee',
  'Creamy chilled coffee blended with espresso, milk, sugar, and vanilla ice cream, topped with chocolate drizzle.',
  5900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/cold-coffee.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'a2effc37-68da-4d70-a2ce-a6eb46f2d583',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'ab5d8f0b-f4e1-4a6f-a3c8-cd9d92ba82f1',
  'Vanilla Ice Cream',
  'Two scoops of classic smooth vanilla bean ice cream served chilled in a glass bowl.',
  3900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/vanilla-ice-cream.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'a435657b-21be-4f81-a1cc-e670674de0ee',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'ab5d8f0b-f4e1-4a6f-a3c8-cd9d92ba82f1',
  'Chocolate Ice Cream',
  'Rich and creamy scoops of dark chocolate ice cream garnished with chocolate chips and chocolate sauce.',
  4900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/chocolate-ice-cream.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '0e72e02e-7d46-43fe-ac26-97a0a7fef421',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'ab5d8f0b-f4e1-4a6f-a3c8-cd9d92ba82f1',
  'Sizzling Brownie',
  'Warm fudgy chocolate brownie served on a sizzling hot iron plate with vanilla ice cream and hot fudge.',
  14900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/sizzling-brownie.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '924d4346-6fee-47f4-aa58-4bd9f51a7d25',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  'ab5d8f0b-f4e1-4a6f-a3c8-cd9d92ba82f1',
  'Kulhad Chocolaty Mud Pie',
  'Decadent chocolate mud cake layered with chocolate ganache and crumble, served inside a traditional clay kulhad.',
  19900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/kulhad-chocolaty-mud-pie.jpg',
  true,
  'veg'::public.veg_type,
  ARRAY['must-try']::TEXT[],
  3
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  '8c8bbbd4-ba82-4a07-abef-5db36e14d5d6',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '29a90d88-3caf-41cc-ac7f-961d3904ccf9',
  'MEAL FOR TWO',
  'Perfect meal combo featuring 1 Pizza Siciliano, 1 Wrap of choice, 1 French Fries, and 2 refreshing Mojitos.',
  41900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/meal-for-two.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  0
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'f38392c2-1411-444a-a655-07479a6cf95b',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '29a90d88-3caf-41cc-ac7f-961d3904ccf9',
  'MEAL FOR THREE',
  'Satisfying group meal combo featuring 1 Margherita Pizza, 3 Garden Fresh Burgers, 3 Garlic Bread Slices, 1 French Fries, and 3 Mojitos.',
  53900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/meal-for-three.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  1
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.menu_items (
  id,
  cafe_id,
  category_id,
  name,
  description,
  price_cents,
  image_url,
  is_available,
  veg_type,
  tags,
  sort_order
)
VALUES (
  'b126a6a9-003d-4511-a543-8130ab368ef0',
  (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'),
  '29a90d88-3caf-41cc-ac7f-961d3904ccf9',
  'MEAL FOR FOUR',
  'Grand feast combo containing 1 Cheese Bliss Pizza, 4 Garden Fresh Burgers, 1 Piri Piri Fries, 4 Garlic Bread Slices, and 4 Mojitos.',
  59900,
  'menu-images/7a81ca36-39a5-4425-a348-9ce59d4dff8b/meal-for-four.jpg',
  true,
  'veg'::public.veg_type,
  '{}'::TEXT[],
  2
)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available,
  veg_type = EXCLUDED.veg_type,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 4. Provision Dining Tables (Tables 1 to 5)
INSERT INTO public.tables (id, cafe_id, label, seats, is_active)
VALUES ('1e804758-7538-4a61-acac-5982fc15feca', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), '1', 4, true)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  label = EXCLUDED.label,
  seats = EXCLUDED.seats,
  is_active = EXCLUDED.is_active;

INSERT INTO public.tables (id, cafe_id, label, seats, is_active)
VALUES ('733272de-362c-409f-a7c7-438e3d54fee2', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), '2', 4, true)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  label = EXCLUDED.label,
  seats = EXCLUDED.seats,
  is_active = EXCLUDED.is_active;

INSERT INTO public.tables (id, cafe_id, label, seats, is_active)
VALUES ('b8ce9675-e147-4268-a4d7-37038dcac67a', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), '3', 4, true)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  label = EXCLUDED.label,
  seats = EXCLUDED.seats,
  is_active = EXCLUDED.is_active;

INSERT INTO public.tables (id, cafe_id, label, seats, is_active)
VALUES ('7c035d3a-06b6-42b9-a1cd-d255a6d738f6', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), '4', 4, true)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  label = EXCLUDED.label,
  seats = EXCLUDED.seats,
  is_active = EXCLUDED.is_active;

INSERT INTO public.tables (id, cafe_id, label, seats, is_active)
VALUES ('670b6070-5bc9-4820-aff7-8fb52e91f3ad', (SELECT id FROM public.cafes WHERE slug = 'cheesecorner'), '5', 4, true)
ON CONFLICT (id) DO UPDATE SET
  cafe_id = EXCLUDED.cafe_id,
  label = EXCLUDED.label,
  seats = EXCLUDED.seats,
  is_active = EXCLUDED.is_active;

