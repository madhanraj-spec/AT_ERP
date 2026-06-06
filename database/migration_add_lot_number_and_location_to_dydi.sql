-- Migration: Add lot_number and location_id to dyed_yarn_delivery_items for lot-specific tracking
ALTER TABLE dyed_yarn_delivery_items 
ADD COLUMN IF NOT EXISTS lot_number TEXT,
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES master_locations(id);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_dydi_lot_number ON dyed_yarn_delivery_items(lot_number);
CREATE INDEX IF NOT EXISTS idx_dydi_location_id ON dyed_yarn_delivery_items(location_id);
