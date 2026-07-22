-- ============================================================
-- AT Fabric ERP: Add E-Way Bill fields to Deliveries and Orders
-- ============================================================

-- 1. Update processing_orders (POF)
ALTER TABLE public.processing_orders 
ADD COLUMN IF NOT EXISTS eway_bill_no TEXT,
ADD COLUMN IF NOT EXISTS eway_bill_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS eway_bill_status TEXT DEFAULT 'not_generated',
ADD COLUMN IF NOT EXISTS eway_bill_error TEXT,
ADD COLUMN IF NOT EXISTS eway_bill_details JSONB DEFAULT '{}'::jsonb;

-- 2. Update greige_yarn_delivery_receipts (DOF deliveries)
ALTER TABLE public.greige_yarn_delivery_receipts 
ADD COLUMN IF NOT EXISTS eway_bill_no TEXT,
ADD COLUMN IF NOT EXISTS eway_bill_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS eway_bill_status TEXT DEFAULT 'not_generated',
ADD COLUMN IF NOT EXISTS eway_bill_error TEXT,
ADD COLUMN IF NOT EXISTS eway_bill_details JSONB DEFAULT '{}'::jsonb;

-- 3. Update dyed_yarn_deliveries (WOF, SOF, WVOF deliveries)
ALTER TABLE public.dyed_yarn_deliveries 
ADD COLUMN IF NOT EXISTS eway_bill_no TEXT,
ADD COLUMN IF NOT EXISTS eway_bill_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS eway_bill_status TEXT DEFAULT 'not_generated',
ADD COLUMN IF NOT EXISTS eway_bill_error TEXT,
ADD COLUMN IF NOT EXISTS eway_bill_details JSONB DEFAULT '{}'::jsonb;
