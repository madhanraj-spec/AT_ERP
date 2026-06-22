-- ============================================================
-- Migration: Create production_finance_bills table
-- Covers bill creation, approval and settlement for
-- job-work warping, sizing, and weaving partners.
-- ============================================================

CREATE TABLE IF NOT EXISTS production_finance_bills (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Identity
    bill_number         TEXT NOT NULL UNIQUE,          -- e.g. "RAMSONS WARPERS/INV-001"
    form_type           TEXT NOT NULL CHECK (form_type IN ('warping', 'sizing', 'weaving')),

    -- Partner
    partner_id          UUID REFERENCES master_partners(id),
    partner_name        TEXT NOT NULL,

    -- Invoice Details
    invoice_number      TEXT NOT NULL,
    invoice_date        DATE NOT NULL,

    -- Selected order-form IDs (array of WOF / SOF / WVOF UUIDs)
    selected_form_ids   UUID[] NOT NULL DEFAULT '{}',

    -- Bill Line Items (JSONB array per order form)
    -- Each item: { form_id, form_number, order_number, design_name, design_no,
    --              planned_qty, actual_qty, start_date, end_date,
    --              actual_start_date, actual_end_date, timeliness_status,
    --              rate_per_meter, calculated_total }
    bill_items          JSONB NOT NULL DEFAULT '[]',

    -- Financials
    calculated_total    NUMERIC(14,2) NOT NULL DEFAULT 0,   -- sum(qty × rate)
    invoice_subtotal    NUMERIC(14,2) NOT NULL DEFAULT 0,   -- partner's claimed pre-tax (≤ calculated_total)
    tax_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
    invoice_total       NUMERIC(14,2) NOT NULL DEFAULT 0,   -- invoice_subtotal + tax_amount

    -- Workflow Status
    status              TEXT NOT NULL DEFAULT 'awaiting_approval'
                            CHECK (status IN ('awaiting_approval', 'approved', 'rejected', 'settled')),

    -- Submission
    submitted_by        UUID REFERENCES profiles(id),
    submitted_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    -- Approval
    approved_by         UUID REFERENCES profiles(id),
    approved_at         TIMESTAMP WITH TIME ZONE,
    admin_notes         TEXT,

    -- Settlement
    settled_by          UUID REFERENCES profiles(id),
    settled_at          TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pfb_form_type   ON production_finance_bills(form_type);
CREATE INDEX IF NOT EXISTS idx_pfb_partner_id  ON production_finance_bills(partner_id);
CREATE INDEX IF NOT EXISTS idx_pfb_status      ON production_finance_bills(status);
CREATE INDEX IF NOT EXISTS idx_pfb_created_at  ON production_finance_bills(created_at DESC);

-- RLS
ALTER TABLE production_finance_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pfb_select" ON production_finance_bills;
CREATE POLICY "pfb_select" ON production_finance_bills
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pfb_insert" ON production_finance_bills;
CREATE POLICY "pfb_insert" ON production_finance_bills
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pfb_update" ON production_finance_bills;
CREATE POLICY "pfb_update" ON production_finance_bills
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pfb_delete" ON production_finance_bills;
CREATE POLICY "pfb_delete" ON production_finance_bills
    FOR DELETE USING (auth.role() = 'authenticated');
