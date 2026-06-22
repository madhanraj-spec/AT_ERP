-- Migration: Add beam_id and beam_name to sizing_order_forms table
ALTER TABLE sizing_order_forms
ADD COLUMN IF NOT EXISTS beam_id UUID REFERENCES master_beams(id),
ADD COLUMN IF NOT EXISTS beam_name TEXT;
