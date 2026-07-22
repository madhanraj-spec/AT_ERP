-- Migration: Add HSN Code column to greige_yarn_receipts
-- HSN Code is entered per yarn count item during receipt creation

ALTER TABLE greige_yarn_receipts
ADD COLUMN IF NOT EXISTS hsn_code TEXT;

COMMENT ON COLUMN greige_yarn_receipts.hsn_code IS 'HSN Code for the yarn count item, entered during receipt creation';
