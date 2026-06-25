-- ============================================================
-- AT Fabric ERP: Add original_qty to warping_order_forms
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE warping_order_forms
ADD COLUMN IF NOT EXISTS original_qty NUMERIC;
