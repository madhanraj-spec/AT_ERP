-- ============================================================
-- AT Fabric ERP: Add fabric_rolls to weaving_orders
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE weaving_orders
ADD COLUMN IF NOT EXISTS fabric_rolls JSONB DEFAULT '[]'::jsonb;
