-- Migration: Add finance columns to dyeing_order_forms table
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS finance_status TEXT NOT NULL DEFAULT 'pending' CHECK (finance_status IN ('pending', 'awaiting_approval', 'approved', 'settled'));
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS finance_bill_no TEXT;
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS finance_prices JSONB DEFAULT '{}'::jsonb;
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS finance_total_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS finance_submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS finance_submitted_by UUID REFERENCES profiles(id);
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS finance_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS finance_approved_by UUID REFERENCES profiles(id);
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS finance_settled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS finance_settled_by UUID REFERENCES profiles(id);

-- Create index for faster querying by finance status
CREATE INDEX IF NOT EXISTS idx_dof_finance_status ON dyeing_order_forms(finance_status);

-- Update RLS UPDATE policy to allow all authenticated users (Merchandisers, Yarn department, Admins)
-- to update DOFs (needed for status updates and finance submission).
DROP POLICY IF EXISTS "Admin can update DOFs" ON dyeing_order_forms;
CREATE POLICY "Allow authenticated users to update DOFs" ON dyeing_order_forms FOR UPDATE USING (
  auth.role() = 'authenticated'
);
