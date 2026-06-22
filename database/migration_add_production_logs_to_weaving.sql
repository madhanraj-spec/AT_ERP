-- ============================================================
-- AT Fabric ERP: Add production_logs to weaving_orders
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE weaving_orders
ADD COLUMN IF NOT EXISTS production_logs JSONB DEFAULT '[]'::jsonb;
