-- ============================================================
-- AT Fabric ERP: Add E-Way Bill fields to fabric_movements table
-- ============================================================

ALTER TABLE public.fabric_movements 
ADD COLUMN IF NOT EXISTS eway_bill_no TEXT,
ADD COLUMN IF NOT EXISTS eway_bill_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS eway_bill_status TEXT DEFAULT 'not_generated',
ADD COLUMN IF NOT EXISTS eway_bill_error TEXT,
ADD COLUMN IF NOT EXISTS eway_bill_details JSONB DEFAULT '{}'::jsonb;
