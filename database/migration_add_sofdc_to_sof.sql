-- ============================================================
-- AT Fabric ERP: Add sofdc_number to sizing_order_forms table
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE sizing_order_forms
ADD COLUMN IF NOT EXISTS sofdc_number TEXT;
