-- ============================================================
-- Migration: Add process fields to sizing_order_forms
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE sizing_order_forms
ADD COLUMN IF NOT EXISTS sizer_name TEXT,
ADD COLUMN IF NOT EXISTS process_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS process_completed_at TIMESTAMP WITH TIME ZONE;
