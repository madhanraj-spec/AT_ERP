-- ============================================================
-- AT Fabric ERP: Greige Yarn Delivery (GYDR) — Supabase Setup
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- STEP 1: Extend DOF status to support delivery tracking statuses
ALTER TABLE dyeing_order_forms
  DROP CONSTRAINT IF EXISTS dyeing_order_forms_status_check;

ALTER TABLE dyeing_order_forms
  ADD CONSTRAINT dyeing_order_forms_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'partially_sent', 'fully_sent'));

-- STEP 2: GYDR Number Generator (AT/YYYY/GYDR/00001)
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

-- STEP 3: Delivery Receipt Header Table
CREATE TABLE IF NOT EXISTS greige_yarn_delivery_receipts (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    gydr_number     TEXT NOT NULL UNIQUE,
    dof_id          UUID REFERENCES dyeing_order_forms(id),
    dof_number      TEXT NOT NULL,
    delivered_by    TEXT NOT NULL,
    vehicle_no      TEXT,
    remarks         TEXT,
    created_by      UUID REFERENCES profiles(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gydr_dof_id     ON greige_yarn_delivery_receipts(dof_id);
CREATE INDEX IF NOT EXISTS idx_gydr_dof_number ON greige_yarn_delivery_receipts(dof_number);
CREATE INDEX IF NOT EXISTS idx_gydr_created_at ON greige_yarn_delivery_receipts(created_at DESC);

-- STEP 4: Delivery Line Items Table
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

-- STEP 5: Row Level Security
ALTER TABLE greige_yarn_delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE greige_yarn_delivery_items    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gydr_read"    ON greige_yarn_delivery_receipts;
DROP POLICY IF EXISTS "gydr_insert"  ON greige_yarn_delivery_receipts;
DROP POLICY IF EXISTS "gydr_update"  ON greige_yarn_delivery_receipts;
DROP POLICY IF EXISTS "gydi_read"    ON greige_yarn_delivery_items;
DROP POLICY IF EXISTS "gydi_insert"  ON greige_yarn_delivery_items;
DROP POLICY IF EXISTS "gydi_update"  ON greige_yarn_delivery_items;
DROP POLICY IF EXISTS "gydi_delete"  ON greige_yarn_delivery_items;

CREATE POLICY "gydr_read"    ON greige_yarn_delivery_receipts FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "gydr_insert"  ON greige_yarn_delivery_receipts FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "gydr_update"  ON greige_yarn_delivery_receipts FOR UPDATE  USING (auth.role() = 'authenticated');

CREATE POLICY "gydi_read"    ON greige_yarn_delivery_items FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "gydi_insert"  ON greige_yarn_delivery_items FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "gydi_update"  ON greige_yarn_delivery_items FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "gydi_delete"  ON greige_yarn_delivery_items FOR DELETE  USING (auth.role() = 'authenticated');

-- Done! ✅
-- Tables created:
--   greige_yarn_delivery_receipts (GYDR header, one per delivery event)
--   greige_yarn_delivery_items    (line items: count, colour, qty, location)
-- Function created:
--   get_next_gydr_number(year) → generates AT/YYYY/GYDR/00001 sequence
-- DOF status constraint extended to include: partially_sent, fully_sent
