-- Migration: Add order_id to greige_yarn_delivery_items for better tracking
ALTER TABLE greige_yarn_delivery_items 
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);

CREATE INDEX IF NOT EXISTS idx_gydi_order_id ON greige_yarn_delivery_items(order_id);
