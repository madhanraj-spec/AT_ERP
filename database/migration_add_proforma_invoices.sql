-- ============================================================
-- Migration: Create proforma_invoices table and updates
-- ============================================================

-- 1. Alter master_partners to add address, GSTIN, and state fields
ALTER TABLE master_partners ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE master_partners ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE master_partners ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE master_partners ADD COLUMN IF NOT EXISTS state_code TEXT;

-- 2. Alter orders to add buyer PO details
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_po_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_po_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_po_file_url TEXT;

-- 3. Create proforma_invoices table
CREATE TABLE IF NOT EXISTS proforma_invoices (
    id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_number          TEXT UNIQUE NOT NULL,
    invoice_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    order_id                UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    
    -- PO Info
    buyer_po_number         TEXT,
    buyer_po_date           DATE,
    vehicle_number          TEXT,
    
    -- Billed To Details
    billed_to_partner_id    UUID REFERENCES master_partners(id) ON DELETE SET NULL,
    billed_to_name          TEXT NOT NULL,
    billed_to_address       TEXT,
    billed_to_gstin         TEXT,
    billed_to_state         TEXT,
    billed_to_state_code    TEXT,
    
    -- Shipped To Details
    shipped_to_partner_id   UUID REFERENCES master_partners(id) ON DELETE SET NULL,
    shipped_to_name         TEXT NOT NULL,
    shipped_to_address      TEXT,
    shipped_to_gstin        TEXT,
    shipped_to_state        TEXT,
    shipped_to_state_code   TEXT,
    
    -- Item Details (Calculated based on Order specifications)
    hsn_code                TEXT,
    uom                     TEXT DEFAULT 'Meter',
    qty                     NUMERIC(14,2) NOT NULL DEFAULT 0,
    rate                    NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount                  NUMERIC(14,2) NOT NULL DEFAULT 0, -- qty * rate
    discount_percent        NUMERIC(5,2) DEFAULT 0,
    taxable_value           NUMERIC(14,2) NOT NULL DEFAULT 0, -- amount after discount
    
    -- Tax details
    cgst_percent            NUMERIC(5,2) DEFAULT 0,
    cgst_amount             NUMERIC(14,2) DEFAULT 0,
    sgst_percent            NUMERIC(5,2) DEFAULT 0,
    sgst_amount             NUMERIC(14,2) DEFAULT 0,
    igst_percent            NUMERIC(5,2) DEFAULT 0,
    igst_amount             NUMERIC(14,2) DEFAULT 0,
    total_gst_amount        NUMERIC(14,2) DEFAULT 0,
    total_invoice_price     NUMERIC(14,2) DEFAULT 0,
    
    -- Terms & Conditions details
    transport_mode          TEXT,
    delivery_date           DATE,
    payment_terms           TEXT,
    quality_tolerance       TEXT,
    remarks                 TEXT,
    bank_details            TEXT,
    
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS and setup policies
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON proforma_invoices;
CREATE POLICY "Allow authenticated read" ON proforma_invoices FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert" ON proforma_invoices;
CREATE POLICY "Allow authenticated insert" ON proforma_invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update" ON proforma_invoices;
CREATE POLICY "Allow authenticated update" ON proforma_invoices FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete" ON proforma_invoices;
CREATE POLICY "Allow authenticated delete" ON proforma_invoices FOR DELETE USING (auth.role() = 'authenticated');

-- 5. Safe ALTER statements to update existing tables if already created
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS transport_mode TEXT;
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS quality_tolerance TEXT;
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS bank_details TEXT;
