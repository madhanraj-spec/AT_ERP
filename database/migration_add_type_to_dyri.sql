-- Migration: Add yarn_type to dyed_yarn_receipt_items for process-specific tracking
-- This allows historical records to remember if yarn was Warp or Weft

ALTER TABLE dyed_yarn_receipt_items 
ADD COLUMN IF NOT EXISTS yarn_type TEXT;

CREATE INDEX IF NOT EXISTS idx_dyri_yarn_type ON dyed_yarn_receipt_items(yarn_type);
