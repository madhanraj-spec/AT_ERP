-- ============================================================
-- Migration: Add wofdc_number and yarn_returns to warping_order_forms
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE warping_order_forms
ADD COLUMN IF NOT EXISTS wofdc_number TEXT,
ADD COLUMN IF NOT EXISTS yarn_returns JSONB NOT NULL DEFAULT '[]';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wof_wofdc_number ON warping_order_forms(wofdc_number);
