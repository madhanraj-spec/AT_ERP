-- Migration: Add redyeing fields to dyed_yarn_deliveries and update constraints/columns on dyed_yarn_delivery_items
ALTER TABLE dyed_yarn_deliveries ADD COLUMN IF NOT EXISTS dof_id UUID REFERENCES dyeing_order_forms(id);
ALTER TABLE dyed_yarn_deliveries ADD COLUMN IF NOT EXISTS dof_number TEXT;
ALTER TABLE dyed_yarn_deliveries ADD COLUMN IF NOT EXISTS dyeing_unit_id UUID REFERENCES master_partners(id);
ALTER TABLE dyed_yarn_deliveries ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'production' CHECK (delivery_type IN ('production', 'redyeing'));

-- Update check constraint on process_type to include 'redyeing'
ALTER TABLE dyed_yarn_delivery_items DROP CONSTRAINT IF EXISTS dyed_yarn_delivery_items_process_type_check;
ALTER TABLE dyed_yarn_delivery_items ADD CONSTRAINT dyed_yarn_delivery_items_process_type_check CHECK (process_type IN ('warping', 'weaving', 'redyeing'));

-- Add yarn_type to dyed_yarn_delivery_items for warping/weaving calculations
ALTER TABLE dyed_yarn_delivery_items ADD COLUMN IF NOT EXISTS yarn_type TEXT;
