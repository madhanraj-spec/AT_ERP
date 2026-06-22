-- ============================================================
-- Migration: Add sizing and weaving forwarding to warping_order_forms and create sizing_order_forms table
-- ============================================================

-- 1. Add forwarding columns to warping_order_forms if they do not exist
ALTER TABLE warping_order_forms
ADD COLUMN IF NOT EXISTS forwarded_to TEXT CHECK (forwarded_to IN ('sizing', 'weaving')),
ADD COLUMN IF NOT EXISTS sizing_type TEXT CHECK (sizing_type IN ('in_house', 'job_work')),
ADD COLUMN IF NOT EXISTS warp_splits_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS warp_splits JSONB DEFAULT '[]';

-- 2. Create sizing_order_forms table
CREATE TABLE IF NOT EXISTS sizing_order_forms (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sof_number          TEXT NOT NULL UNIQUE,
    wof_id              UUID REFERENCES warping_order_forms(id) ON DELETE CASCADE NOT NULL,
    order_id            UUID REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    sizing_type         TEXT NOT NULL CHECK (sizing_type IN ('in_house', 'job_work')),
    qty                 NUMERIC NOT NULL DEFAULT 0,    -- Warp quantity (meters)
    start_date          DATE,
    end_date            DATE,
    status              TEXT NOT NULL DEFAULT 'created'
                            CHECK (status IN ('created', 'on_process', 'completed', 'stopped')),
    
    -- Machine / Partner details for Sizing
    machine_id          UUID REFERENCES master_machines(id),
    machine_name        TEXT,
    partner_id          UUID REFERENCES master_partners(id),
    partner_name        TEXT,

    -- Audit
    created_by          UUID REFERENCES profiles(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for sizing_order_forms
CREATE INDEX IF NOT EXISTS idx_sof_wof_id     ON sizing_order_forms(wof_id);
CREATE INDEX IF NOT EXISTS idx_sof_order_id   ON sizing_order_forms(order_id);
CREATE INDEX IF NOT EXISTS idx_sof_status     ON sizing_order_forms(status);
CREATE INDEX IF NOT EXISTS idx_sof_created_at ON sizing_order_forms(created_at DESC);

-- Enable RLS for sizing_order_forms
ALTER TABLE sizing_order_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sof_select" ON sizing_order_forms;
CREATE POLICY "sof_select" ON sizing_order_forms
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "sof_insert" ON sizing_order_forms;
CREATE POLICY "sof_insert" ON sizing_order_forms
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "sof_update" ON sizing_order_forms;
CREATE POLICY "sof_update" ON sizing_order_forms
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "sof_delete" ON sizing_order_forms;
CREATE POLICY "sof_delete" ON sizing_order_forms
    FOR DELETE USING (auth.role() = 'authenticated');
