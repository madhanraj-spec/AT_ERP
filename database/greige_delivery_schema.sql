-- ============================================================
-- AT Fabric ERP: Greige Yarn Delivery Receipts (GYDR) Schema
-- ============================================================

-- STEP 1: Extend DOF status to support delivery tracking
-- Run this in Supabase SQL Editor

-- Drop old check constraint and re-add with new values
ALTER TABLE dyeing_order_forms
  DROP CONSTRAINT IF EXISTS dyeing_order_forms_status_check;

ALTER TABLE dyeing_order_forms
  ADD CONSTRAINT dyeing_order_forms_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'partially_sent', 'fully_sent'));

-- ============================================================
-- STEP 2: GYDR Number Generator
-- Format: AT/YYYY/GYDR/00001
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_gydr_number(p_year int)
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_next_val int;
  v_gydr_number text;
BEGIN
  v_prefix := 'AT/' || p_year || '/GYDR/';

  SELECT COALESCE(MAX(CAST(SUBSTRING(gydr_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_next_val
  FROM greige_yarn_delivery_receipts
  WHERE gydr_number LIKE v_prefix || '%';

  v_gydr_number := v_prefix || LPAD(v_next_val::text, 5, '0');
  RETURN v_gydr_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 3: Main Delivery Receipt Table (Header)
-- One row per delivery event
-- ============================================================
CREATE TABLE IF NOT EXISTS greige_yarn_delivery_receipts (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    gydr_number     TEXT NOT NULL UNIQUE,    -- e.g. AT/2026/GYDR/00001
    dof_id          UUID REFERENCES dyeing_order_forms(id),
    dof_number      TEXT NOT NULL,           -- denormalized for fast lookup
    delivered_by    TEXT NOT NULL,
    vehicle_no      TEXT,
    remarks         TEXT,
    created_by      UUID REFERENCES profiles(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gydr_dof_id     ON greige_yarn_delivery_receipts(dof_id);
CREATE INDEX IF NOT EXISTS idx_gydr_dof_number ON greige_yarn_delivery_receipts(dof_number);
CREATE INDEX IF NOT EXISTS idx_gydr_created_at ON greige_yarn_delivery_receipts(created_at DESC);

-- ============================================================
-- STEP 4: Delivery Line Items Table
-- One row per count+colour delivered in a receipt
-- ============================================================
CREATE TABLE IF NOT EXISTS greige_yarn_delivery_items (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    receipt_id      UUID REFERENCES greige_yarn_delivery_receipts(id) ON DELETE CASCADE,
    yarn_count_id   UUID REFERENCES master_yarn_counts(id),
    colour          TEXT NOT NULL,
    quantity_kg     NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
    location_id     UUID REFERENCES master_locations(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gydi_receipt_id    ON greige_yarn_delivery_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_gydi_yarn_count_id ON greige_yarn_delivery_items(yarn_count_id);

-- ============================================================
-- STEP 5: Row Level Security
-- ============================================================
ALTER TABLE greige_yarn_delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE greige_yarn_delivery_items    ENABLE ROW LEVEL SECURITY;

-- Drop old policies if any
DROP POLICY IF EXISTS "Allow authenticated read receipts"   ON greige_yarn_delivery_receipts;
DROP POLICY IF EXISTS "Allow authenticated insert receipts" ON greige_yarn_delivery_receipts;
DROP POLICY IF EXISTS "Allow authenticated update receipts" ON greige_yarn_delivery_receipts;
DROP POLICY IF EXISTS "Allow authenticated read items"     ON greige_yarn_delivery_items;
DROP POLICY IF EXISTS "Allow authenticated insert items"   ON greige_yarn_delivery_items;
DROP POLICY IF EXISTS "Allow authenticated update items"   ON greige_yarn_delivery_items;
DROP POLICY IF EXISTS "Allow authenticated delete items"   ON greige_yarn_delivery_items;

-- Receipt Policies
CREATE POLICY "Allow authenticated read receipts"   ON greige_yarn_delivery_receipts FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert receipts" ON greige_yarn_delivery_receipts FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update receipts" ON greige_yarn_delivery_receipts FOR UPDATE  USING (auth.role() = 'authenticated');

-- Items Policies
CREATE POLICY "Allow authenticated read items"     ON greige_yarn_delivery_items FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert items"   ON greige_yarn_delivery_items FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update items"   ON greige_yarn_delivery_items FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete items"   ON greige_yarn_delivery_items FOR DELETE  USING (auth.role() = 'authenticated');
