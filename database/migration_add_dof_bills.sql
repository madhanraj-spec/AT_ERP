-- ============================================================
-- Migration: Create dof_bills table
-- Covers bill creation, approval and settlement for
-- job-work dyeing partners.
-- ============================================================

CREATE TABLE IF NOT EXISTS dof_bills (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Identity
    bill_number         TEXT NOT NULL UNIQUE,          -- e.g. "AT/2627/DOF/B/00001"

    -- Partner
    partner_id          UUID REFERENCES master_partners(id),
    partner_name        TEXT NOT NULL,

    -- Invoice Details
    invoice_number      TEXT NOT NULL,
    invoice_date        DATE NOT NULL,

    -- Selected order-form IDs (array of DOF UUIDs)
    selected_dof_ids   UUID[] NOT NULL DEFAULT '{}',

    -- Bill Line Items (JSONB array)
    -- Each item: { dof_id, dof_number, order_numbers, design_names, design_nos,
    --              yarn_details: [{ count_id, count_label, colour, quantity_kg, price_per_kg, total_price }] }
    bill_items          JSONB NOT NULL DEFAULT '[]',

    -- Financials
    calculated_total    NUMERIC(14,2) NOT NULL DEFAULT 0,   -- sum(qty × price_per_kg for all items)
    tax_percent         NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
    bill_total          NUMERIC(14,2) NOT NULL DEFAULT 0,   -- calculated_total + tax_amount

    -- Workflow Status
    status              TEXT NOT NULL DEFAULT 'submitted'
                            CHECK (status IN ('submitted', 'approved', 'rejected', 'settled')),

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
CREATE INDEX IF NOT EXISTS idx_dof_bills_partner_id  ON dof_bills(partner_id);
CREATE INDEX IF NOT EXISTS idx_dof_bills_status      ON dof_bills(status);
CREATE INDEX IF NOT EXISTS idx_dof_bills_created_at  ON dof_bills(created_at DESC);

-- Enable RLS
ALTER TABLE dof_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dof_bills_select" ON dof_bills;
CREATE POLICY "dof_bills_select" ON dof_bills
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dof_bills_insert" ON dof_bills;
CREATE POLICY "dof_bills_insert" ON dof_bills
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dof_bills_update" ON dof_bills;
CREATE POLICY "dof_bills_update" ON dof_bills
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "dof_bills_delete" ON dof_bills;
CREATE POLICY "dof_bills_delete" ON dof_bills
    FOR DELETE USING (auth.role() = 'authenticated');

-- Alter dyeing_order_forms to add bill status and ID
ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS bill_status TEXT DEFAULT 'pending'
    CHECK (bill_status IN ('pending', 'submitted', 'approved', 'settled'));

ALTER TABLE dyeing_order_forms ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES dof_bills(id);

-- Create generator function for next dof bill number
CREATE OR REPLACE FUNCTION get_next_dof_bill_number(p_year_prefix text)
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_next_val int;
  v_bill_number text;
BEGIN
  v_prefix := 'AT/' || p_year_prefix || '/DOF/B/';

  SELECT COALESCE(MAX(CAST(SUBSTRING(bill_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_next_val
  FROM dof_bills
  WHERE bill_number LIKE v_prefix || '%';

  v_bill_number := v_prefix || LPAD(v_next_val::text, 5, '0');
  RETURN v_bill_number;
END;
$$ LANGUAGE plpgsql;
