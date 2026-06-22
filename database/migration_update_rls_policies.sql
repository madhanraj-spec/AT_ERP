-- Migration: Update RLS policies for orders and dyeing_order_forms
-- to allow all authenticated users to read (SELECT) them, resolving visibility issues for non-admin/non-creator users.

-- 1. Update orders SELECT policy
DROP POLICY IF EXISTS "Merchandisers see own orders" ON orders;
CREATE POLICY "Allow authenticated users to read orders" 
ON orders FOR SELECT 
USING (auth.role() = 'authenticated');

-- 2. Update dyeing_order_forms SELECT policy
DROP POLICY IF EXISTS "Merchandiser sees own DOFs" ON dyeing_order_forms;
CREATE POLICY "Allow authenticated users to read DOFs" 
ON dyeing_order_forms FOR SELECT 
USING (auth.role() = 'authenticated');
