-- Migration to allow multiple yarn counts per GYRR receipt number
ALTER TABLE greige_yarn_receipts DROP CONSTRAINT IF EXISTS greige_yarn_receipts_receipt_no_key;
