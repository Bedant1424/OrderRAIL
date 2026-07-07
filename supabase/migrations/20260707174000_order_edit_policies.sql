-- Grant update/delete privileges to customer and staff roles
GRANT UPDATE ON public.orders TO anon, authenticated;
GRANT DELETE ON public.order_items TO anon, authenticated;

-- Add RLS policy for customer to update pending orders
CREATE POLICY "orders customer update" ON public.orders 
  FOR UPDATE 
  TO anon, authenticated 
  USING (status = 'pending') 
  WITH CHECK (status = 'pending');

-- Add RLS policies for deleting order items
CREATE POLICY "order_items customer delete" ON public.order_items 
  FOR DELETE 
  TO anon 
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id AND status = 'pending'
    )
  );

CREATE POLICY "order_items staff delete" ON public.order_items 
  FOR DELETE 
  TO authenticated 
  USING (true);
