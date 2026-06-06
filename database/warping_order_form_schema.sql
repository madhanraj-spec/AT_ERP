-- ============================================================
-- AT Fabric ERP: Warping Order Forms (WOF) Schema
-- Run this in Supabase Studio SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS warping_order_forms (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wof_number          TEXT NOT NULL UNIQUE,
    order_id            UUID REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    wof_type            TEXT NOT NULL CHECK (wof_type IN ('in_house', 'job_work')),

    -- Machine / Partner
    machine_id          UUID REFERENCES master_machines(id),
    machine_name        TEXT,                          -- denormalized for display
    partner_id          UUID REFERENCES master_partners(id),  -- job_work only
    partner_name        TEXT,                          -- denormalized for display

    -- Scheduling
    start_date          DATE,
    end_date            DATE,
    qty                 NUMERIC NOT NULL DEFAULT 0,    -- WOF quantity (meters)

    -- Colour / Count allotments: [{countId, countValue, colour, required_qty, allotted_qty}]
    colour_allotments   JSONB NOT NULL DEFAULT '[]',

    -- Status: created | on_process | completed | stopped
    status              TEXT NOT NULL DEFAULT 'created'
                            CHECK (status IN ('created', 'on_process', 'completed', 'stopped')),

    -- Audit
    created_by          UUID REFERENCES profiles(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wof_order_id     ON warping_order_forms(order_id);
CREATE INDEX IF NOT EXISTS idx_wof_partner_id   ON warping_order_forms(partner_id);
CREATE INDEX IF NOT EXISTS idx_wof_status       ON warping_order_forms(status);
CREATE INDEX IF NOT EXISTS idx_wof_created_at   ON warping_order_forms(created_at DESC);

-- RLS
ALTER TABLE warping_order_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wof_select" ON warping_order_forms;
CREATE POLICY "wof_select" ON warping_order_forms
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "wof_insert" ON warping_order_forms;
CREATE POLICY "wof_insert" ON warping_order_forms
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "wof_update" ON warping_order_forms;
CREATE POLICY "wof_update" ON warping_order_forms
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "wof_delete" ON warping_order_forms;
CREATE POLICY "wof_delete" ON warping_order_forms
    FOR DELETE USING (auth.role() = 'authenticated');
