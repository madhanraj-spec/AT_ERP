-- Migration: Add detailed return tracking columns to greige_yarn_receipts
ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS colour TEXT;
ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS yarn_type TEXT;
ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gyr_colour ON greige_yarn_receipts(colour);
CREATE INDEX IF NOT EXISTS idx_gyr_yarn_type ON greige_yarn_receipts(yarn_type);
CREATE INDEX IF NOT EXISTS idx_gyr_order_id ON greige_yarn_receipts(order_id);
