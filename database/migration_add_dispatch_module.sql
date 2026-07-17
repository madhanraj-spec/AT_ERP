-- ============================================================
-- Migration: Create/Update Dispatch Module tables
-- ============================================================

DROP TABLE IF EXISTS dispatch_package_slips CASCADE;
DROP TABLE IF EXISTS dispatch_bills CASCADE;

-- 1. Create dispatch_package_slips table
CREATE TABLE IF NOT EXISTS dispatch_package_slips (
    id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    slip_number            TEXT UNIQUE NOT NULL,
    slip_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    buyer_id                UUID REFERENCES master_brands(id) ON DELETE SET NULL,
    order_id                UUID REFERENCES orders(id) ON DELETE CASCADE,
    pi_numbers              TEXT,
    po_number               TEXT,
    vendor_name             TEXT,
    vendor_address          TEXT,
    vendor_gstin            TEXT,
    design_name             TEXT,
    design_no               TEXT,
    count                   TEXT,
    construction            TEXT,
    avg_weight_meter        NUMERIC(10,4),
    total_rolls             INTEGER DEFAULT 0,
    total_qty               NUMERIC(14,2) DEFAULT 0,
    total_weight            NUMERIC(14,2) DEFAULT 0,
    remarks                 TEXT,
    items                   JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of {roll_id, qty, weight}
    status                  TEXT NOT NULL DEFAULT 'created', -- 'created' or 'dispatched'
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create dispatch_bills table
CREATE TABLE IF NOT EXISTS dispatch_bills (
    id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    bill_number             TEXT UNIQUE NOT NULL,
    bill_date               DATE NOT NULL DEFAULT CURRENT_DATE,
    buyer_id                UUID REFERENCES master_brands(id) ON DELETE SET NULL,
    order_id                UUID REFERENCES orders(id) ON DELETE CASCADE,
    package_slip_ids        JSONB NOT NULL DEFAULT '[]'::jsonb, -- list of slip numbers or IDs linked
    items                   JSONB NOT NULL DEFAULT '[]'::jsonb, -- detailed items list
    hsn_code                TEXT DEFAULT '5208',
    uom                     TEXT DEFAULT 'Meter',
    qty                     NUMERIC(14,2) NOT NULL DEFAULT 0,
    rate                    NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount                  NUMERIC(14,2) NOT NULL DEFAULT 0, -- qty * rate
    discount_percent        NUMERIC(5,2) DEFAULT 0,
    discount_amount         NUMERIC(14,2) DEFAULT 0,
    taxable_value           NUMERIC(14,2) NOT NULL DEFAULT 0, -- amount after discount
    cgst_percent            NUMERIC(5,2) DEFAULT 0,
    cgst_amount             NUMERIC(14,2) DEFAULT 0,
    sgst_percent            NUMERIC(5,2) DEFAULT 0,
    sgst_amount             NUMERIC(14,2) DEFAULT 0,
    igst_percent            NUMERIC(5,2) DEFAULT 0,
    igst_amount             NUMERIC(14,2) DEFAULT 0,
    total_gst_amount        NUMERIC(14,2) DEFAULT 0,
    total_bill_price        NUMERIC(14,2) DEFAULT 0,
    payment_terms           TEXT,
    quality_tolerance       TEXT,
    bank_details            TEXT,
    remarks                 TEXT,
    billed_from_address     TEXT,
    billed_to_address       TEXT,
    shipped_from_address    TEXT,
    shipped_to_address      TEXT,
    transport_name          TEXT,
    transport_mode          TEXT,
    vehicle_number          TEXT,
    vehicle_type            TEXT, -- 'ODC', 'R'
    freight_type            TEXT, -- 'Collection', 'Prepaid', 'To Pay', 'Self Paid', 'Self To Pay'
    lr_no                   TEXT,
    lr_date                 DATE,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS and setup policies for dispatch_package_slips
ALTER TABLE dispatch_package_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on slips" ON dispatch_package_slips;
CREATE POLICY "Allow authenticated read on slips" ON dispatch_package_slips FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert on slips" ON dispatch_package_slips;
CREATE POLICY "Allow authenticated insert on slips" ON dispatch_package_slips FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update on slips" ON dispatch_package_slips;
CREATE POLICY "Allow authenticated update on slips" ON dispatch_package_slips FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete on slips" ON dispatch_package_slips;
CREATE POLICY "Allow authenticated delete on slips" ON dispatch_package_slips FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Enable RLS and setup policies for dispatch_bills
ALTER TABLE dispatch_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on dispatch bills" ON dispatch_bills;
CREATE POLICY "Allow authenticated read on dispatch bills" ON dispatch_bills FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert on dispatch bills" ON dispatch_bills;
CREATE POLICY "Allow authenticated insert on dispatch bills" ON dispatch_bills FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update on dispatch bills" ON dispatch_bills;
CREATE POLICY "Allow authenticated update on dispatch bills" ON dispatch_bills FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete on dispatch bills" ON dispatch_bills;
CREATE POLICY "Allow authenticated delete on dispatch bills" ON dispatch_bills FOR DELETE USING (auth.role() = 'authenticated');
