-- ============================================================
-- Migration: Update proforma_invoices table for multi-order support
-- ============================================================

-- 1. Add order_ids array column for multi-order PIs
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS order_ids UUID[];

-- 2. Add items JSONB column for per-order line items (qty, rate, hsn, tax, amount)
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS items JSONB;

-- 3. Add created_by column referencing auth.users for role-based merchandiser filtering
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 4. Make order_id NULLABLE to support multi-order PIs cleanly
ALTER TABLE proforma_invoices ALTER COLUMN order_id DROP NOT NULL;

-- 5. Create GIN index on order_ids for fast array querying
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_order_ids ON proforma_invoices USING GIN (order_ids);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_created_by ON proforma_invoices (created_by);
