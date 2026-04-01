-- Create function to update menu orders atomically
CREATE OR REPLACE FUNCTION update_menu_orders(p_orders jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order jsonb;
BEGIN
  -- Validate that the user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can update menu orders';
  END IF;

  FOR v_order IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    UPDATE public.menus
    SET order_index = (v_order->>'order_index')::integer
    WHERE id = (v_order->>'id')::uuid;
  END LOOP;
END;
$$;
