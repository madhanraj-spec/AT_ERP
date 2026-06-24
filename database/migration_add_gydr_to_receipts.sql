-- Migration: Add GYDR reference to greige_yarn_receipts for production returns
ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS gydr_id UUID REFERENCES greige_yarn_delivery_receipts(id);
ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS gydr_no TEXT;

CREATE INDEX IF NOT EXISTS idx_gyr_gydr_id ON greige_yarn_receipts(gydr_id);
