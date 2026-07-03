-- ============================================================
-- Migration: Add Rewash and Billing Columns to processing_orders
-- ============================================================

ALTER TABLE public.processing_orders ADD COLUMN IF NOT EXISTS is_rewash BOOLEAN DEFAULT FALSE;
ALTER TABLE public.processing_orders ADD COLUMN IF NOT EXISTS is_billing BOOLEAN DEFAULT FALSE;
