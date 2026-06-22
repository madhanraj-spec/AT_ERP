-- ============================================================
-- AT Fabric ERP: Add WVOFDC and Yarn Returns to Weaving Orders
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE weaving_orders
ADD COLUMN IF NOT EXISTS wvofdc_number TEXT,
ADD COLUMN IF NOT EXISTS yarn_returns JSONB NOT NULL DEFAULT '[]';
