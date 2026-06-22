-- Migration: Add width column to processing_orders table
ALTER TABLE processing_orders ADD COLUMN IF NOT EXISTS width TEXT;
