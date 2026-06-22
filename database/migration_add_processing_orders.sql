-- ============================================================
-- AT Fabric ERP: Processing Orders (POF) Schema
-- ============================================================

-- Function to generate the next unique POF number: AT/YYYY/POF/00001
CREATE OR REPLACE FUNCTION get_next_pof_number(p_year int)
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_next_val int;
  v_pof_number text;
BEGIN
  v_prefix := 'AT/' || p_year || '/POF/';

  SELECT COALESCE(MAX(CAST(SUBSTRING(pof_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_next_val
  FROM processing_orders
  WHERE pof_number LIKE v_prefix || '%';

  v_pof_number := v_prefix || LPAD(v_next_val::text, 5, '0');
  RETURN v_pof_number;
END;
$$ LANGUAGE plpgsql;

-- Main Table for Processing Orders
CREATE TABLE IF NOT EXISTS processing_orders (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pof_number            TEXT UNIQUE NOT NULL,
  created_by            UUID REFERENCES profiles(id) NOT NULL,
  partner_id            UUID REFERENCES master_partners(id) NOT NULL,
  partner_name          TEXT NOT NULL,
  expected_delivery_date DATE NOT NULL,
  
  -- Array of weaving order IDs linked to this POF
  weaving_order_ids     UUID[] NOT NULL,
  
  -- JSONB list of fabric rolls sent
  -- Each roll: { id, qty, actual_qty, order_number, design_no, design_name, weaving_order_id }
  fabric_rolls          JSONB NOT NULL DEFAULT '[]',
  
  -- Array of processes selected (e.g. Desize Chamber, Zero-Zero, fabric Dyeing, Brushing, Peaching)
  processes             TEXT[] NOT NULL,
  
  -- Vehicle and delivery person details
  vehicle_details       TEXT,
  delivered_by          TEXT,
  received_by           TEXT,
  receive_vehicle_details TEXT,
  received_place        TEXT,
  pofrr_number          TEXT UNIQUE,
  received_rolls        JSONB NOT NULL DEFAULT '[]',
  width                 TEXT,
  
  -- Status of the POF: 'sent_to_processing', 'partially_received', 'received'
  status                TEXT NOT NULL DEFAULT 'sent_to_processing'
                          CHECK (status IN ('sent_to_processing', 'partially_received', 'received')),
                          
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  received_at           TIMESTAMP WITH TIME ZONE
);

-- Retrofit existing tables if they were created without these columns
ALTER TABLE processing_orders DROP CONSTRAINT IF EXISTS processing_orders_status_check;
ALTER TABLE processing_orders ADD CONSTRAINT processing_orders_status_check CHECK (status IN ('sent_to_processing', 'partially_received', 'received'));
ALTER TABLE processing_orders ADD COLUMN IF NOT EXISTS received_by TEXT;
ALTER TABLE processing_orders ADD COLUMN IF NOT EXISTS receive_vehicle_details TEXT;
ALTER TABLE processing_orders ADD COLUMN IF NOT EXISTS received_place TEXT;
ALTER TABLE processing_orders ADD COLUMN IF NOT EXISTS pofrr_number TEXT UNIQUE;
ALTER TABLE processing_orders ADD COLUMN IF NOT EXISTS received_rolls JSONB DEFAULT '[]';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_pof_number ON processing_orders(pof_number);
CREATE INDEX IF NOT EXISTS idx_po_status ON processing_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_created_at ON processing_orders(created_at DESC);

-- Enable RLS
ALTER TABLE processing_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow authenticated read processing orders" ON processing_orders;
CREATE POLICY "Allow authenticated read processing orders" ON processing_orders
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert processing orders" ON processing_orders;
CREATE POLICY "Allow authenticated insert processing orders" ON processing_orders
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update processing orders" ON processing_orders;
CREATE POLICY "Allow authenticated update processing orders" ON processing_orders
    FOR UPDATE USING (auth.role() = 'authenticated');
