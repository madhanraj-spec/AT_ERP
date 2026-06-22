-- ============================================================
-- AT Fabric ERP: Add planned_daily_production to weaving_orders
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE weaving_orders
ADD COLUMN IF NOT EXISTS planned_daily_production JSONB DEFAULT '[]'::jsonb;
