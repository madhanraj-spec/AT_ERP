-- Migration to add DELETE policy to the orders table
-- This prevents silent delete failures where the row is deleted from UI state but not from the database due to RLS blocking.

DROP POLICY IF EXISTS "Allow authenticated users to delete orders" ON orders;
CREATE POLICY "Allow authenticated users to delete orders" 
ON orders FOR DELETE 
USING (auth.role() = 'authenticated');
