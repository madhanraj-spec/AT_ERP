-- ============================================================
-- AT Fabric ERP: Add details to weaving_orders
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE weaving_orders
ADD COLUMN IF NOT EXISTS qty NUMERIC,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS weaving_type TEXT DEFAULT 'in_house',
ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES master_machines(id),
ADD COLUMN IF NOT EXISTS machine_name TEXT,
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES master_partners(id),
ADD COLUMN IF NOT EXISTS partner_name TEXT,
ADD COLUMN IF NOT EXISTS wof_id UUID REFERENCES warping_order_forms(id),
ADD COLUMN IF NOT EXISTS wof_number TEXT,
ADD COLUMN IF NOT EXISTS sof_id UUID REFERENCES sizing_order_forms(id),
ADD COLUMN IF NOT EXISTS sof_number TEXT,
ADD COLUMN IF NOT EXISTS beam_number TEXT,
ADD COLUMN IF NOT EXISTS weft_allotments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS process_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS process_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Add RLS policies for INSERT, UPDATE, and DELETE on weaving_orders
DROP POLICY IF EXISTS "weaving_insert" ON weaving_orders;
CREATE POLICY "weaving_insert" ON weaving_orders
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "weaving_update" ON weaving_orders;
CREATE POLICY "weaving_update" ON weaving_orders
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "weaving_delete" ON weaving_orders;
CREATE POLICY "weaving_delete" ON weaving_orders
    FOR DELETE USING (auth.role() = 'authenticated');

