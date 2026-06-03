-- Migration: Add DC Number and Received By to Dyed Yarn Receipts
ALTER TABLE dyed_yarn_receipts 
ADD COLUMN IF NOT EXISTS dc_number TEXT,
ADD COLUMN IF NOT EXISTS received_by TEXT;
