-- Function to generate the next unique order number in format AT/YYYY/B or S/00001
CREATE OR REPLACE FUNCTION get_next_order_number(p_year int, p_type text)
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_short_type text;
  v_next_val int;
  v_order_number text;
BEGIN
  -- Determine middle code: B for Bulk, S for Sample
  v_short_type := CASE WHEN lower(p_type) = 'bulk' THEN 'B' ELSE 'S' END;
  
  -- Base prefix
  v_prefix := 'AT/' || p_year || '/' || v_short_type || '/';
  
  -- Get the next sequence number by looking at existing orders for that year and type
  -- We extract the last part of the order_number and increment
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_next_val
  FROM orders
  WHERE order_number LIKE v_prefix || '%';
  
  -- Format with leading zeros (5 digits)
  v_order_number := v_prefix || LPAD(v_next_val::text, 5, '0');
  
  RETURN v_order_number;
END;
$$ LANGUAGE plpgsql;
