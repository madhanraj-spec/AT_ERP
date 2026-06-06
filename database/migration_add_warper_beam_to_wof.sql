-- ============================================================
-- Migration: Add warper_name and beam_id to warping_order_forms
-- For tracking who is operating the machine and which beam is used
-- ============================================================

ALTER TABLE warping_order_forms
ADD COLUMN IF NOT EXISTS warper_name TEXT,
ADD COLUMN IF NOT EXISTS beam_id UUID REFERENCES master_beams(id),
ADD COLUMN IF NOT EXISTS beam_name TEXT,
ADD COLUMN IF NOT EXISTS process_started_at TIMESTAMP WITH TIME ZONE;
