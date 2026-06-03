-- ============================================================
-- AT Fabric ERP: Warping & Weaving Order Forms Scaffolding
-- ============================================================

-- STEP 1: Warping Orders
CREATE TABLE IF NOT EXISTS warping_orders (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id        UUID REFERENCES orders(id),
    warping_number  TEXT NOT NULL UNIQUE,
    design_no       TEXT,
    status          TEXT DEFAULT 'pending', -- pending, in_progress, completed
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- STEP 2: Weaving Orders
CREATE TABLE IF NOT EXISTS weaving_orders (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id        UUID REFERENCES orders(id),
    weaving_number  TEXT NOT NULL UNIQUE,
    design_no       TEXT,
    status          TEXT DEFAULT 'pending',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE warping_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE weaving_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warping_read" ON warping_orders;
CREATE POLICY "warping_read" ON warping_orders FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "weaving_read" ON weaving_orders;
CREATE POLICY "weaving_read" ON weaving_orders FOR SELECT USING (auth.role() = 'authenticated');
