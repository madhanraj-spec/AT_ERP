-- ============================================================
-- Migration: Create fabric_movements table
-- Covers tracking fabric movement challans (FMDCs) between locations
-- ============================================================

CREATE TABLE IF NOT EXISTS fabric_movements (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    fmdc_number         TEXT NOT NULL UNIQUE,          -- e.g. "AT/2026/FMDC/00001"
    from_location       TEXT NOT NULL,
    to_location         TEXT NOT NULL,
    sent_by             TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'SENT - YET TO RECEIVE',
    rolls               JSONB NOT NULL DEFAULT '[]',   -- array of rolls details at movement time
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE fabric_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fm_select" ON fabric_movements;
CREATE POLICY "fm_select" ON fabric_movements
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fm_insert" ON fabric_movements;
CREATE POLICY "fm_insert" ON fabric_movements
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fm_update" ON fabric_movements;
CREATE POLICY "fm_update" ON fabric_movements
    FOR UPDATE USING (auth.role() = 'authenticated');
