-- Bootstrap process for OrderRail
-- Checks if the default cafe exists, and if not, inserts it.
-- Subsequently provisions 10 default tables for the cafe.

DO $$
DECLARE
  _cafe_id UUID;
  _cat_coffee_id UUID;
  _cat_tea_id UUID;
  _cat_breakfast_id UUID;
  _cat_sandwiches_id UUID;
  _cat_burgers_id UUID;
  _cat_pizza_id UUID;
  _cat_pasta_id UUID;
  _cat_desserts_id UUID;
  _cat_shakes_id UUID;
  _cat_beverages_id UUID;
BEGIN
  -- Insert cafe if not exists
  IF NOT EXISTS (SELECT 1 FROM public.cafes WHERE slug = 'orderrail') THEN
    INSERT INTO public.cafes (name, slug, currency)
    VALUES ('OrderRail', 'orderrail', 'INR');
  END IF;

  -- Get the cafe ID
  SELECT id INTO _cafe_id FROM public.cafes WHERE slug = 'orderrail' LIMIT 1;

  -- Seed tables 1 through 10
  FOR i IN 1..10 LOOP
    IF NOT EXISTS (SELECT 1 FROM public.tables WHERE cafe_id = _cafe_id AND label = i::text) THEN
      INSERT INTO public.tables (cafe_id, label, seats)
      VALUES (_cafe_id, i::text, 4);
    END IF;
  END LOOP;

  -- Clear existing menu items and categories for this cafe to allow seeding a fresh premium menu
  DELETE FROM public.menu_items WHERE cafe_id = _cafe_id;
  DELETE FROM public.menu_categories WHERE cafe_id = _cafe_id;

  -- Seed Categories
  INSERT INTO public.menu_categories (cafe_id, name, sort_order) VALUES (_cafe_id, 'Coffee', 1) RETURNING id INTO _cat_coffee_id;
  INSERT INTO public.menu_categories (cafe_id, name, sort_order) VALUES (_cafe_id, 'Tea', 2) RETURNING id INTO _cat_tea_id;
  INSERT INTO public.menu_categories (cafe_id, name, sort_order) VALUES (_cafe_id, 'Breakfast', 3) RETURNING id INTO _cat_breakfast_id;
  INSERT INTO public.menu_categories (cafe_id, name, sort_order) VALUES (_cafe_id, 'Sandwiches', 4) RETURNING id INTO _cat_sandwiches_id;
  INSERT INTO public.menu_categories (cafe_id, name, sort_order) VALUES (_cafe_id, 'Burgers', 5) RETURNING id INTO _cat_burgers_id;
  INSERT INTO public.menu_categories (cafe_id, name, sort_order) VALUES (_cafe_id, 'Pizza', 6) RETURNING id INTO _cat_pizza_id;
  INSERT INTO public.menu_categories (cafe_id, name, sort_order) VALUES (_cafe_id, 'Pasta', 7) RETURNING id INTO _cat_pasta_id;
  INSERT INTO public.menu_categories (cafe_id, name, sort_order) VALUES (_cafe_id, 'Desserts', 8) RETURNING id INTO _cat_desserts_id;
  INSERT INTO public.menu_categories (cafe_id, name, sort_order) VALUES (_cafe_id, 'Shakes', 9) RETURNING id INTO _cat_shakes_id;
  INSERT INTO public.menu_categories (cafe_id, name, sort_order) VALUES (_cafe_id, 'Beverages', 10) RETURNING id INTO _cat_beverages_id;

  -- Seed Menu Items
  -- Coffee
  INSERT INTO public.menu_items (cafe_id, category_id, name, description, price_cents, image_url, tags, sort_order) VALUES
  (_cafe_id, _cat_coffee_id, 'Classic Espresso', 'Rich and bold double shot of our house signature blend espresso.', 18000, 'https://images.unsplash.com/photo-151097252790b-af4f42d9101e?w=500&auto=format&fit=crop&q=60', ARRAY['Popular', 'Veg'], 1),
  (_cafe_id, _cat_coffee_id, 'Vanilla Cappuccino', 'Espresso with steamed milk, thick layer of foam, and sweet vanilla extract.', 24000, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop&q=60', ARRAY['Bestseller', 'Veg'], 2),
  (_cafe_id, _cat_coffee_id, 'Caramel Macchiato', 'Espresso poured over steamed milk, marked with vanilla syrup and caramel drizzle.', 28000, 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=500&auto=format&fit=crop&q=60', ARRAY['Chef''s Choice', 'Veg'], 3),
  (_cafe_id, _cat_coffee_id, 'Spanish Latte', 'Sweetened condensed milk topped with espresso shots and textured fresh milk.', 26000, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=60', ARRAY['New', 'Veg'], 4),
  (_cafe_id, _cat_coffee_id, 'Irish Cold Brew', 'Slow-steeped cold brew coffee sweetened with non-alcoholic Irish cream syrup.', 25000, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 5);

  -- Tea
  INSERT INTO public.menu_items (cafe_id, category_id, name, description, price_cents, image_url, tags, sort_order) VALUES
  (_cafe_id, _cat_tea_id, 'Masala Chai', 'Traditional Indian tea brewed with milk and aromatic cardamoms, cinnamon, and ginger.', 15000, 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=500&auto=format&fit=crop&q=60', ARRAY['Bestseller', 'Veg'], 1),
  (_cafe_id, _cat_tea_id, 'Organic Green Tea', 'Pure organic Japanese sencha green tea leaves steeped to golden perfection.', 12000, 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 2),
  (_cafe_id, _cat_tea_id, 'Classic Earl Grey', 'Fragrant black tea infused with natural bergamot oil and cornflower petals.', 14000, 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 3),
  (_cafe_id, _cat_tea_id, 'Hibiscus Iced Tea', 'Refreshing floral iced tea brewed with sweet hibiscus petals and a hint of fresh mint.', 16000, 'https://images.unsplash.com/photo-1499638472904-ea5c6178a300?w=500&auto=format&fit=crop&q=60', ARRAY['New', 'Veg'], 4),
  (_cafe_id, _cat_tea_id, 'Chamomile Infusion', 'Soothing and relaxing caffeine-free herbal tea with sweet chamomile flowers.', 13000, 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 5);

  -- Breakfast
  INSERT INTO public.menu_items (cafe_id, category_id, name, description, price_cents, image_url, tags, sort_order) VALUES
  (_cafe_id, _cat_breakfast_id, 'Avocado Toast', 'Artisanal sourdough bread topped with mashed avocado, cherry tomatoes, and microgreens.', 32000, 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=500&auto=format&fit=crop&q=60', ARRAY['Popular', 'Veg'], 1),
  (_cafe_id, _cat_breakfast_id, 'Buttermilk Pancakes', 'Fluffy buttermilk pancakes served with maple syrup, whipped butter, and fresh berries.', 28000, 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=500&auto=format&fit=crop&q=60', ARRAY['Chef''s Choice', 'Veg'], 2),
  (_cafe_id, _cat_breakfast_id, 'Eggs Benedict', 'Poached eggs and smoked turkey breast on toasted English muffins, topped with hollandaise sauce.', 38000, 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=500&auto=format&fit=crop&q=60', ARRAY['Bestseller', 'Non-Veg'], 3),
  (_cafe_id, _cat_breakfast_id, 'Butter Croissant', 'Flaky, golden-brown butter croissant served warm with fruit preserves.', 16000, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=60', ARRAY['New', 'Veg'], 4),
  (_cafe_id, _cat_breakfast_id, 'Healthy Oatmeal Bowl', 'Organic rolled oats cooked in almond milk, topped with banana, chia seeds, walnuts, and honey.', 24000, 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 5);

  -- Sandwiches
  INSERT INTO public.menu_items (cafe_id, category_id, name, description, price_cents, image_url, tags, sort_order) VALUES
  (_cafe_id, _cat_sandwiches_id, 'Double-Decker Club', 'Grilled chicken breast, crispy bacon, fried egg, lettuce, and tomatoes in toasted white bread.', 36000, 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&auto=format&fit=crop&q=60', ARRAY['Bestseller', 'Non-Veg'], 1),
  (_cafe_id, _cat_sandwiches_id, 'Caprese Panini', 'Toasted sourdough bread pressed with fresh mozzarella, sliced tomatoes, and basil pesto.', 32000, 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=500&auto=format&fit=crop&q=60', ARRAY['Popular', 'Veg'], 2),
  (_cafe_id, _cat_sandwiches_id, 'Three-Cheese Grilled', 'Artisanal bread loaded with melted Cheddar, Swiss, and Provolone cheeses.', 28000, 'https://images.unsplash.com/photo-1475090169767-40ed8d18a67d?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 3),
  (_cafe_id, _cat_sandwiches_id, 'Smoked Salmon Bagel', 'Toasted bagel spread with cream cheese, capers, red onions, and premium smoked salmon slices.', 45000, 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=500&auto=format&fit=crop&q=60', ARRAY['Chef''s Choice', 'Non-Veg'], 4),
  (_cafe_id, _cat_sandwiches_id, 'Turkey & Cranberry', 'Sliced roast turkey breast, cranberry sauce, Swiss cheese, and wild rocket leaves.', 34000, 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=500&auto=format&fit=crop&q=60', ARRAY['Non-Veg'], 5);

  -- Burgers
  INSERT INTO public.menu_items (cafe_id, category_id, name, description, price_cents, image_url, tags, sort_order) VALUES
  (_cafe_id, _cat_burgers_id, 'Classic Beef Burger', 'Flame-grilled beef patty, melted cheddar, lettuce, tomato, and house special burger sauce.', 38000, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60', ARRAY['Popular', 'Non-Veg'], 1),
  (_cafe_id, _cat_burgers_id, 'Crispy Chicken Burger', 'Crispy buttermilk-fried chicken breast, spicy mayo, pickles, and shredded lettuce.', 36000, 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=500&auto=format&fit=crop&q=60', ARRAY['Bestseller', 'Non-Veg'], 2),
  (_cafe_id, _cat_burgers_id, 'Truffle Mushroom Burger', 'Beef patty with sautéed wild mushrooms, Swiss cheese, caramelized onions, and truffle aioli.', 42000, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&auto=format&fit=crop&q=60', ARRAY['Chef''s Choice', 'Non-Veg'], 3),
  (_cafe_id, _cat_burgers_id, 'BBQ Pulled Pork Burger', 'Slow-cooked pulled pork tossed in smoky barbecue sauce, topped with coleslaw and onion rings.', 40000, 'https://images.unsplash.com/photo-1521305916504-4a1121188589?w=500&auto=format&fit=crop&q=60', ARRAY['Non-Veg'], 4),
  (_cafe_id, _cat_burgers_id, 'Spicy Veggie Burger', 'Crisp potato, corn, and green pea patty topped with cheese, jalapeños, and hot sriracha sauce.', 30000, 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?w=500&auto=format&fit=crop&q=60', ARRAY['Spicy', 'Veg'], 5);

  -- Pizza
  INSERT INTO public.menu_items (cafe_id, category_id, name, description, price_cents, image_url, tags, sort_order) VALUES
  (_cafe_id, _cat_pizza_id, 'Classic Margherita', 'Stone-baked thin crust pizza topped with tangy tomato sauce, fresh mozzarella, and basil.', 39000, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60', ARRAY['Popular', 'Veg'], 1),
  (_cafe_id, _cat_pizza_id, 'Pepperoni Feast', 'Double loaded pepperoni slices, mozzarella, and dynamic tomato sauce with herbs.', 45000, 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&auto=format&fit=crop&q=60', ARRAY['Bestseller', 'Non-Veg'], 2),
  (_cafe_id, _cat_pizza_id, 'BBQ Chicken Pizza', 'Grilled chicken cubes, red onions, chopped cilantro, and sweet barbecue sauce base.', 44000, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&auto=format&fit=crop&q=60', ARRAY['Non-Veg'], 3),
  (_cafe_id, _cat_pizza_id, 'Four Cheese Pizza', 'Rich blend of Mozzarella, Gorgonzola, Parmesan, and Ricotta cheeses baked to golden brown.', 46000, 'https://images.unsplash.com/photo-1573821663912-569905455b1c?w=500&auto=format&fit=crop&q=60', ARRAY['Chef''s Choice', 'Veg'], 4),
  (_cafe_id, _cat_pizza_id, 'Garden Veggie Pizza', 'Crisp bell peppers, red onions, mushrooms, black olives, and sweet corn on a thin crust.', 38000, 'https://images.unsplash.com/photo-1571066811602-71683a3f680d?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 5);

  -- Pasta
  INSERT INTO public.menu_items (cafe_id, category_id, name, description, price_cents, image_url, tags, sort_order) VALUES
  (_cafe_id, _cat_pasta_id, 'Fettuccine Alfredo', 'Rich fettuccine pasta tossed in a creamy, velvety parmesan butter garlic sauce.', 36000, 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=500&auto=format&fit=crop&q=60', ARRAY['Popular', 'Veg'], 1),
  (_cafe_id, _cat_pasta_id, 'Spaghetti Carbonara', 'Classic spaghetti tossed with crispy bacon, egg yolks, parmesan cheese, and black pepper.', 38000, 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=500&auto=format&fit=crop&q=60', ARRAY['Bestseller', 'Non-Veg'], 2),
  (_cafe_id, _cat_pasta_id, 'Penne Arrabbiata', 'Penne pasta tossed in a spicy, fiery tomato sauce with garlic and dried chili flakes.', 32000, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=60', ARRAY['Spicy', 'Veg'], 3),
  (_cafe_id, _cat_pasta_id, 'Pesto Chicken Pasta', 'Penne tossed in fresh basil pesto cream sauce, topped with grilled chicken strips.', 42000, 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&auto=format&fit=crop&q=60', ARRAY['Chef''s Choice', 'Non-Veg'], 4),
  (_cafe_id, _cat_pasta_id, 'Classic Meat Lasagna', 'Baked layers of flat pasta sheets, rich bolognese meat sauce, cheese, and bechamel.', 44000, 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=500&auto=format&fit=crop&q=60', ARRAY['Non-Veg'], 5);

  -- Desserts
  INSERT INTO public.menu_items (cafe_id, category_id, name, description, price_cents, image_url, tags, sort_order) VALUES
  (_cafe_id, _cat_desserts_id, 'New York Cheesecake', 'Rich, dense, and creamy classic cheesecake served with a sweet strawberry compote.', 28000, 'https://images.unsplash.com/photo-1524351199679-46cddf530c04?w=500&auto=format&fit=crop&q=60', ARRAY['Bestseller', 'Veg'], 1),
  (_cafe_id, _cat_desserts_id, 'Chocolate Fudge Cake', 'Rich double chocolate sponge cake served warm with a scoop of vanilla ice cream.', 26000, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60', ARRAY['Popular', 'Veg'], 2),
  (_cafe_id, _cat_desserts_id, 'Classic Tiramisu', 'Coffee-soaked ladyfingers layered with whipped mascarpone custard and cocoa powder.', 30000, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500&auto=format&fit=crop&q=60', ARRAY['Chef''s Choice', 'Veg'], 3),
  (_cafe_id, _cat_desserts_id, 'Warm Apple Pie', 'Spiced sweet apple filling baked in a flaky crust, served with caramel syrup.', 25000, 'https://images.unsplash.com/photo-1519869325930-281384150729?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 4),
  (_cafe_id, _cat_desserts_id, 'Fudge Brownie', 'Chewy, fudgy chocolate brownie loaded with roasted walnuts and chocolate chips.', 18000, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60', ARRAY['New', 'Veg'], 5);

  -- Shakes
  INSERT INTO public.menu_items (cafe_id, category_id, name, description, price_cents, image_url, tags, sort_order) VALUES
  (_cafe_id, _cat_shakes_id, 'Belgian Chocolate Shake', 'Thick milkshake blended with premium dark Belgian chocolate and vanilla ice cream.', 22000, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&auto=format&fit=crop&q=60', ARRAY['Bestseller', 'Veg'], 1),
  (_cafe_id, _cat_shakes_id, 'Strawberry Velvet Shake', 'Creamy shake blended with sweet fresh strawberries and whipped cream topping.', 20000, 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 2),
  (_cafe_id, _cat_shakes_id, 'Crunchy Oreo Milkshake', 'Vanilla ice cream blended with crushed Oreo cookies, milk, and chocolate drizzle.', 21000, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&auto=format&fit=crop&q=60', ARRAY['Popular', 'Veg'], 3),
  (_cafe_id, _cat_shakes_id, 'Salted Caramel Shake', 'Creamy shake blended with homemade salted caramel sauce and vanilla bean ice cream.', 23000, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&auto=format&fit=crop&q=60', ARRAY['Chef''s Choice', 'Veg'], 4),
  (_cafe_id, _cat_shakes_id, 'Mango Alphonso Shake', 'Creamy milkshake blended with sweet seasonal Alphonso mango pulp.', 24000, 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=500&auto=format&fit=crop&q=60', ARRAY['New', 'Veg'], 5);

  -- Beverages
  INSERT INTO public.menu_items (cafe_id, category_id, name, description, price_cents, image_url, tags, sort_order) VALUES
  (_cafe_id, _cat_beverages_id, 'Fresh Lime Soda', 'Squeezed fresh lime juice served sweet or salted with carbonated mineral water.', 12000, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 1),
  (_cafe_id, _cat_beverages_id, 'Fresh Orange Juice', '100% freshly squeezed juice from premium Valencia oranges, served chilled.', 18000, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 2),
  (_cafe_id, _cat_beverages_id, 'Sparkling Lemon Water', 'Naturally carbonated mineral water served chilled with fresh lemon slices.', 14000, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=60', ARRAY['Veg'], 3),
  (_cafe_id, _cat_beverages_id, 'Classic Virgin Mojito', 'Refreshing summer beverage with muddled mint leaves, lime, sugar, and sparkling soda.', 16000, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60', ARRAY['Popular', 'Veg'], 4),
  (_cafe_id, _cat_beverages_id, 'Gourmet Hot Chocolate', 'Rich melted chocolate steam-whipped with fresh whole milk, topped with mini marshmallows.', 20000, 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&auto=format&fit=crop&q=60', ARRAY['Bestseller', 'Veg'], 5);
END $$;
