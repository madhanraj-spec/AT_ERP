-- Migration: Add owner and weight columns to master_beams
ALTER TABLE master_beams
ADD COLUMN IF NOT EXISTS owner TEXT,
ADD COLUMN IF NOT EXISTS weight NUMERIC(10,2);
