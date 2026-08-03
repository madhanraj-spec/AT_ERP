-- ============================================================
-- AT Fabric ERP: Fabric Stock Inventory Schema
-- ============================================================
-- Purpose:
--   1. Store leftover fabric rolls (greige or processed) from
--      completed/dispatched orders into Fabric Stock Orders (FSOs).
--   2. Allot stored stock rolls to new/repeat orders with full
--      pipeline integration (4-Point Inspection, Processing,
--      Wash Inspection, Dispatch).
-- ============================================================

-- Function to generate the next unique FSO number: AT/YYYY/FSO/00001
CREATE OR REPLACE FUNCTION get_next_fso_number(p_year int)
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_next_val int;
  v_fso_number text;
BEGIN
  v_prefix := 'AT/' || p_year || '/FSO/';

  SELECT COALESCE(MAX(CAST(SUBSTRING(fso_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_next_val
  FROM fabric_stock_orders
  WHERE fso_number LIKE v_prefix || '%';

  v_fso_number := v_prefix || LPAD(v_next_val::text, 5, '0');
  RETURN v_fso_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Table: fabric_stock_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS fabric_stock_orders (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fso_number           TEXT UNIQUE NOT NULL,
  source_order_id      UUID REFERENCES orders(id),
  source_order_number  TEXT,
  design_no            TEXT,
  design_name          TEXT,
  color                TEXT,
  quality              TEXT,
  total_rolls          INTEGER NOT NULL DEFAULT 0,
  total_meters         NUMERIC NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'partially_allotted', 'fully_allotted', 'closed')),
  notes                TEXT,
  created_by           UUID REFERENCES profiles(id),
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Retrofit columns if table existed prior
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS source_order_id UUID REFERENCES orders(id);
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS source_order_number TEXT;
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS design_no TEXT;
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS design_name TEXT;
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS quality TEXT;
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS total_rolls INTEGER DEFAULT 0;
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS total_meters NUMERIC DEFAULT 0;
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE fabric_stock_orders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fso_number ON fabric_stock_orders(fso_number);
CREATE INDEX IF NOT EXISTS idx_fso_status ON fabric_stock_orders(status);
CREATE INDEX IF NOT EXISTS idx_fso_source_order ON fabric_stock_orders(source_order_id);
CREATE INDEX IF NOT EXISTS idx_fso_created_at ON fabric_stock_orders(created_at DESC);

-- Enable RLS
ALTER TABLE fabric_stock_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read fabric_stock_orders" ON fabric_stock_orders;
CREATE POLICY "Allow authenticated read fabric_stock_orders" ON fabric_stock_orders
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert fabric_stock_orders" ON fabric_stock_orders;
CREATE POLICY "Allow authenticated insert fabric_stock_orders" ON fabric_stock_orders
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update fabric_stock_orders" ON fabric_stock_orders;
CREATE POLICY "Allow authenticated update fabric_stock_orders" ON fabric_stock_orders
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete fabric_stock_orders" ON fabric_stock_orders;
CREATE POLICY "Allow authenticated delete fabric_stock_orders" ON fabric_stock_orders
    FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- Table: fabric_stock_inventory
-- ============================================================
CREATE TABLE IF NOT EXISTS fabric_stock_inventory (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fso_id                UUID REFERENCES fabric_stock_orders(id) ON DELETE CASCADE,
  fso_number            TEXT NOT NULL DEFAULT '',
  original_roll_id      TEXT NOT NULL DEFAULT '',
  piece_no              TEXT,
  roll_type             TEXT NOT NULL DEFAULT 'greige'
                          CHECK (roll_type IN ('greige', 'processed')),
  original_order_id     UUID REFERENCES orders(id),
  original_order_number TEXT,
  original_design_no    TEXT,
  original_design_name  TEXT,
  original_wvof_number  TEXT,
  original_pof_number   TEXT,
  color                 TEXT,
  meters                NUMERIC NOT NULL DEFAULT 0,
  actual_meters         NUMERIC,
  status                TEXT NOT NULL DEFAULT 'in_stock'
                          CHECK (status IN ('in_stock', 'allotted', 'dispatched')),
  allotted_order_id     UUID REFERENCES orders(id),
  allotted_order_number TEXT,
  allotted_design_no    TEXT,
  allotted_design_name  TEXT,
  allotted_at           TIMESTAMP WITH TIME ZONE,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Retrofit columns if table existed prior
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS fso_id UUID REFERENCES fabric_stock_orders(id) ON DELETE CASCADE;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS fso_number TEXT DEFAULT '';
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS original_roll_id TEXT DEFAULT '';
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS piece_no TEXT;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS roll_type TEXT DEFAULT 'greige';
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS original_order_id UUID REFERENCES orders(id);
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS original_order_number TEXT;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS original_design_no TEXT;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS original_design_name TEXT;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS original_wvof_number TEXT;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS original_pof_number TEXT;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS meters NUMERIC DEFAULT 0;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS actual_meters NUMERIC;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'in_stock';
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS allotted_order_id UUID REFERENCES orders(id);
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS allotted_order_number TEXT;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS allotted_design_no TEXT;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS allotted_design_name TEXT;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS allotted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS roll_id TEXT DEFAULT '';
ALTER TABLE fabric_stock_inventory ALTER COLUMN roll_id DROP NOT NULL;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS inventory_order_name TEXT DEFAULT '';
ALTER TABLE fabric_stock_inventory ALTER COLUMN inventory_order_name DROP NOT NULL;
ALTER TABLE fabric_stock_inventory ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fsi_fso_id ON fabric_stock_inventory(fso_id);
CREATE INDEX IF NOT EXISTS idx_fsi_status ON fabric_stock_inventory(status);
CREATE INDEX IF NOT EXISTS idx_fsi_roll_type ON fabric_stock_inventory(roll_type);
CREATE INDEX IF NOT EXISTS idx_fsi_allotted_order ON fabric_stock_inventory(allotted_order_id);
CREATE INDEX IF NOT EXISTS idx_fsi_original_roll_id ON fabric_stock_inventory(original_roll_id);

-- Enable RLS
ALTER TABLE fabric_stock_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read fabric_stock_inventory" ON fabric_stock_inventory;
CREATE POLICY "Allow authenticated read fabric_stock_inventory" ON fabric_stock_inventory
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert fabric_stock_inventory" ON fabric_stock_inventory;
CREATE POLICY "Allow authenticated insert fabric_stock_inventory" ON fabric_stock_inventory
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update fabric_stock_inventory" ON fabric_stock_inventory;
CREATE POLICY "Allow authenticated update fabric_stock_inventory" ON fabric_stock_inventory
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete fabric_stock_inventory" ON fabric_stock_inventory;
CREATE POLICY "Allow authenticated delete fabric_stock_inventory" ON fabric_stock_inventory
    FOR DELETE USING (auth.role() = 'authenticated');
