-- ============================================================
-- Migration: Add process_completed_at to warping_order_forms
-- For tracking when the warping process actually ended
-- ============================================================

ALTER TABLE warping_order_forms
ADD COLUMN IF NOT EXISTS process_completed_at TIMESTAMP WITH TIME ZONE;
