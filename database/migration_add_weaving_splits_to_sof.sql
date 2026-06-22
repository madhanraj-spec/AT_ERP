-- Migration: Add Weaving split configuration columns to sizing_order_forms table
ALTER TABLE sizing_order_forms
ADD COLUMN IF NOT EXISTS weaving_splits_count INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS weaving_splits JSONB NOT NULL DEFAULT '[]';
