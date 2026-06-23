-- ============================================================
-- AT Fabric ERP: Add warp_no and original_qty columns
-- Run this in Supabase Studio SQL Editor
-- ============================================================

-- 1. Add warp_no and original_qty to sizing_order_forms if they don't exist
ALTER TABLE sizing_order_forms
ADD COLUMN IF NOT EXISTS warp_no TEXT,
ADD COLUMN IF NOT EXISTS original_qty NUMERIC;

-- 2. Add warp_no to weaving_orders if it doesn't exist
ALTER TABLE weaving_orders
ADD COLUMN IF NOT EXISTS warp_no TEXT;
