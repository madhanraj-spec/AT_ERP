-- Migration: Add yarn_type to greige_yarn_delivery_items for process-specific tracking
-- This allows splitting Warp vs Weft quantities in receiving reports

ALTER TABLE greige_yarn_delivery_items 
ADD COLUMN IF NOT EXISTS yarn_type TEXT;

-- Optional: Add constraint to ensure valid types
-- ALTER TABLE greige_yarn_delivery_items 
-- ADD CONSTRAINT greige_yarn_delivery_items_type_check 
-- CHECK (yarn_type IN ('warp', 'weft', 'general'));

CREATE INDEX IF NOT EXISTS idx_gydi_yarn_type ON greige_yarn_delivery_items(yarn_type);
