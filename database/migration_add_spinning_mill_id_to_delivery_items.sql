-- Migration: Add spinning_mill_id to greige_yarn_delivery_items for tracking delivery source mills
ALTER TABLE greige_yarn_delivery_items 
ADD COLUMN IF NOT EXISTS spinning_mill_id UUID REFERENCES master_partners(id);

CREATE INDEX IF NOT EXISTS idx_gydi_spinning_mill_id ON greige_yarn_delivery_items(spinning_mill_id);
