-- ============================================================
-- Migration: Create processing_finance_bills table
-- Covers bill creation, approval and settlement for outsource fabric processing.
-- ============================================================

CREATE TABLE IF NOT EXISTS processing_finance_bills (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Identity
    bill_number         TEXT NOT NULL UNIQUE,          -- e.g. "PARTNER/2026/0001"

    -- Partner
    partner_id          UUID REFERENCES master_partners(id),
    partner_name        TEXT NOT NULL,

    -- Selected order-form IDs (array of POF UUIDs)
    selected_pof_ids   UUID[] NOT NULL DEFAULT '{}',

    -- Bill Line Items (JSONB array per POF)
    -- Each item: { pof_id, pof_number, greige_sent_rolls, greige_sent_qty,
    --              processed_rolls_recd, processed_qty_recd, shrinkage,
    --              sent_date, received_date, status, processes }
    bill_items          JSONB NOT NULL DEFAULT '[]',

    -- Financial calculations per process
    -- Array of process rates: [{ process, rate_per_meter, calculated_total }]
    process_rates       JSONB NOT NULL DEFAULT '[]',

    -- Financials
    calculated_total    NUMERIC(14,2) NOT NULL DEFAULT 0,   -- sum(qty × rate for each process)
    tax_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
    invoice_total       NUMERIC(14,2) NOT NULL DEFAULT 0,   -- calculated_total + tax_amount

    -- Workflow Status
    status              TEXT NOT NULL DEFAULT 'submitted_for_approval'
                            CHECK (status IN ('submitted_for_approval', 'approved', 'settled')),

    -- Submission
    submitted_by        UUID REFERENCES profiles(id),
    submitted_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    -- Approval
    approved_by         UUID REFERENCES profiles(id),
    approved_at         TIMESTAMP WITH TIME ZONE,

    -- Settlement
    settled_by          UUID REFERENCES profiles(id),
    settled_at          TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE processing_finance_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pfb_select" ON processing_finance_bills;
CREATE POLICY "pfb_select" ON processing_finance_bills
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pfb_insert" ON processing_finance_bills;
CREATE POLICY "pfb_insert" ON processing_finance_bills
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "pfb_update" ON processing_finance_bills;
CREATE POLICY "pfb_update" ON processing_finance_bills
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Alter processing_orders to add bill status and ID
ALTER TABLE processing_orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'no_bill'
    CHECK (payment_status IN ('no_bill', 'submitted_for_approval', 'approved', 'settled'));

ALTER TABLE processing_orders ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES processing_finance_bills(id);
