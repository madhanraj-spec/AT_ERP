-- ============================================================
-- Migration: Add DELETE Policies to Dyeing Order Forms (DOF)
-- ============================================================

-- 1. Allow admins to delete any DOF
DROP POLICY IF EXISTS "Admin can delete DOFs" ON dyeing_order_forms;
CREATE POLICY "Admin can delete DOFs" ON dyeing_order_forms FOR DELETE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 2. Allow merchandisers to delete their own pending DOFs
DROP POLICY IF EXISTS "Merchandiser can delete own pending DOFs" ON dyeing_order_forms;
CREATE POLICY "Merchandiser can delete own pending DOFs" ON dyeing_order_forms FOR DELETE USING (
  auth.uid() = created_by AND status = 'pending'
);
