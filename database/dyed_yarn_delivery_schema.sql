-- ============================================================
-- AT Fabric ERP: Dyed Yarn Delivery Receipts (DYDR) Schema
-- ============================================================

-- STEP 1: DYDR Number Generator (AT/YYYY/DYDR/00001)
CREATE OR REPLACE FUNCTION get_next_dydr_number(p_year int)
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_next_val int;
  v_dydr_number text;
BEGIN
  v_prefix := 'AT/' || p_year || '/DYDR/';

  SELECT COALESCE(MAX(CAST(SUBSTRING(dydr_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_next_val
  FROM dyed_yarn_deliveries
  WHERE dydr_number LIKE v_prefix || '%';

  v_dydr_number := v_prefix || LPAD(v_next_val::text, 5, '0');
  RETURN v_dydr_number;
END;
$$ LANGUAGE plpgsql;

-- STEP 2: Dyed Yarn Delivery Header Table
CREATE TABLE IF NOT EXISTS dyed_yarn_deliveries (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    dydr_number     TEXT NOT NULL UNIQUE,
    delivered_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    delivered_by    TEXT,
    vehicle_no      TEXT,
    remarks         TEXT,
    created_by      UUID REFERENCES profiles(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- STEP 3: Dyed Yarn Delivery Items
-- Tracks which yarn (from which order/receipt) is being sent to which production step
CREATE TABLE IF NOT EXISTS dyed_yarn_delivery_items (
    id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    delivery_id       UUID REFERENCES dyed_yarn_deliveries(id) ON DELETE CASCADE,
    
    -- Target Context
    order_id          UUID REFERENCES orders(id),             -- The order this yarn is being USED for
    production_form_id UUID,                                   -- Link to warping_order_forms or weaving_order_forms (generic UUID for now)
    process_type      TEXT CHECK (process_type IN ('warping', 'weaving')),
    
    -- Item Details
    yarn_count_id     UUID REFERENCES master_yarn_counts(id),
    colour            TEXT NOT NULL,
    quantity_kg       NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
    no_of_bags        INTEGER,
    cone_weight       NUMERIC(10,3),
    
    -- Source Reference (Optional, for traceablity to original receipt)
    source_receipt_id UUID REFERENCES dyed_yarn_receipts(id),
    
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dydi_delivery_id ON dyed_yarn_delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_dydi_order_id    ON dyed_yarn_delivery_items(order_id);

-- STEP 4: RLS Policies
ALTER TABLE dyed_yarn_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dyed_yarn_delivery_items    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dydr_read"    ON dyed_yarn_deliveries;
CREATE POLICY "dydr_read"    ON dyed_yarn_deliveries FOR SELECT  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dydr_insert"  ON dyed_yarn_deliveries;
CREATE POLICY "dydr_insert"  ON dyed_yarn_deliveries FOR INSERT  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dydi_read"    ON dyed_yarn_delivery_items;
CREATE POLICY "dydi_read"    ON dyed_yarn_delivery_items FOR SELECT  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dydi_insert"  ON dyed_yarn_delivery_items;
CREATE POLICY "dydi_insert"  ON dyed_yarn_delivery_items FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
