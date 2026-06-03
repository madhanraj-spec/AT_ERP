-- ============================================================
-- AT Fabric ERP: Dyed Yarn Receiving Receipts (DYRR) Schema
-- ============================================================

-- STEP 1: DYRR Number Generator (AT/YYYY/DYRR/00001)
CREATE OR REPLACE FUNCTION get_next_dyrr_number(p_year int)
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_next_val int;
  v_dyrr_number text;
BEGIN
  v_prefix := 'AT/' || p_year || '/DYRR/';

  SELECT COALESCE(MAX(CAST(SUBSTRING(dyrr_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_next_val
  FROM dyed_yarn_receipts
  WHERE dyrr_number LIKE v_prefix || '%';

  v_dyrr_number := v_prefix || LPAD(v_next_val::text, 5, '0');
  RETURN v_dyrr_number;
END;
$$ LANGUAGE plpgsql;

-- STEP 2: Dyed Yarn Receipt Header Table
CREATE TABLE IF NOT EXISTS dyed_yarn_receipts (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    dyrr_number     TEXT NOT NULL UNIQUE,
    dof_id          UUID REFERENCES dyeing_order_forms(id),
    dof_number      TEXT,                    -- denormalized
    dyeing_unit_id  UUID REFERENCES master_partners(id),
    source_type     TEXT NOT NULL DEFAULT 'partner', -- 'partner', 'production_return'
    received_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_no      TEXT,
    remarks         TEXT,
    created_by      UUID REFERENCES profiles(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dyrr_dof_id     ON dyed_yarn_receipts(dof_id);
CREATE INDEX IF NOT EXISTS idx_dyrr_created_at ON dyed_yarn_receipts(created_at DESC);

-- STEP 3: Dyed Yarn Receipt Items
CREATE TABLE IF NOT EXISTS dyed_yarn_receipt_items (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    receipt_id      UUID REFERENCES dyed_yarn_receipts(id) ON DELETE CASCADE,
    order_id        UUID REFERENCES orders(id), -- Specific order this receipt item belongs to
    yarn_count_id   UUID REFERENCES master_yarn_counts(id),
    colour          TEXT NOT NULL,
    quantity_kg     NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
    location_id     UUID REFERENCES master_locations(id),
    cone_weight     NUMERIC(10,3),
    no_of_bags      INTEGER,
    is_excess       BOOLEAN DEFAULT FALSE,  -- True if this yarn is leftover/reusable stock
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dyri_receipt_id    ON dyed_yarn_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_dyri_yarn_count_id ON dyed_yarn_receipt_items(yarn_count_id);
CREATE INDEX IF NOT EXISTS idx_dyri_order_id      ON dyed_yarn_receipt_items(order_id);

-- STEP 4: Row Level Security
ALTER TABLE dyed_yarn_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dyed_yarn_receipt_items    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dyrr_read"    ON dyed_yarn_receipts;
CREATE POLICY "dyrr_read"    ON dyed_yarn_receipts FOR SELECT  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dyrr_insert"  ON dyed_yarn_receipts;
CREATE POLICY "dyrr_insert"  ON dyed_yarn_receipts FOR INSERT  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dyrr_update"  ON dyed_yarn_receipts;
CREATE POLICY "dyrr_update"  ON dyed_yarn_receipts FOR UPDATE  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dyri_read"    ON dyed_yarn_receipt_items;
CREATE POLICY "dyri_read"    ON dyed_yarn_receipt_items FOR SELECT  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dyri_insert"  ON dyed_yarn_receipt_items;
CREATE POLICY "dyri_insert"  ON dyed_yarn_receipt_items FOR INSERT  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dyri_update"  ON dyed_yarn_receipt_items;
CREATE POLICY "dyri_update"  ON dyed_yarn_receipt_items FOR UPDATE  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dyri_delete"  ON dyed_yarn_receipt_items;
CREATE POLICY "dyri_delete"  ON dyed_yarn_receipt_items FOR DELETE  USING (auth.role() = 'authenticated');
