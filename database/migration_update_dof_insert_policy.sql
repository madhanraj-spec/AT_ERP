-- Migration: Update RLS INSERT policy for dyeing_order_forms to allow any authenticated user to create DOFs
DROP POLICY IF EXISTS "Merchandiser can create DOFs" ON dyeing_order_forms;

CREATE POLICY "Allow authenticated users to create DOFs" 
ON dyeing_order_forms 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
