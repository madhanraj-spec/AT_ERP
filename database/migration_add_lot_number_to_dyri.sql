-- Migration: Add lot_number to dyed_yarn_receipt_items for tracking dyed yarn lots
ALTER TABLE dyed_yarn_receipt_items 
ADD COLUMN IF NOT EXISTS lot_number TEXT;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dyri_lot_number ON dyed_yarn_receipt_items(lot_number);
