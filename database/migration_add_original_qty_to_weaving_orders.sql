-- ============================================================
-- AT Fabric ERP: Add original_qty to weaving_orders
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE weaving_orders
ADD COLUMN IF NOT EXISTS original_qty NUMERIC;
