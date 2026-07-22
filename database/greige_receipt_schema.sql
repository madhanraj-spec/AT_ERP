-- AT Fabric ERP: Greige Yarn Receipts Module

-- Table for tracking Greige Yarn received into inventory either from external vendors (Spinning Mills) or internal production returns.
CREATE TABLE IF NOT EXISTS greige_yarn_receipts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    receipt_no TEXT NOT NULL UNIQUE, -- e.g., AT/GYRR/00001
    receipt_type TEXT NOT NULL CHECK (receipt_type IN ('spinning_mill', 'production')),
    
    -- Specific to Production Returns
    order_form_no TEXT,

    -- Specific to Spinning Mills
    spinning_mill_id UUID REFERENCES master_partners(id),
    yarn_count_id UUID REFERENCES master_yarn_counts(id),
    invoice_no TEXT,
    invoice_date DATE,
    invoice_amount NUMERIC(15,2),
    
    -- Package Details
    bag_weight NUMERIC(10,2) DEFAULT 0,
    bag_count INTEGER DEFAULT 0,
    cone_weight NUMERIC(10,2) DEFAULT 0,
    cone_count INTEGER DEFAULT 0,
    rate_per_kg NUMERIC(10,2) DEFAULT 0, -- Added Rate per KG
    hsn_code TEXT, -- HSN Code for the yarn count item
    total_weight NUMERIC(15,2) NOT NULL, -- Final verified math: (bags * bag_weight) + (cones * cone_weight)
    
    -- Logistics & Storage
    location_id UUID REFERENCES master_locations(id),
    vehicle_no TEXT,
    received_by TEXT,
    
    -- Creation Logs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS to ensure security
ALTER TABLE greige_yarn_receipts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to interact with Receipts
CREATE POLICY "Allow authenticated read" ON greige_yarn_receipts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON greige_yarn_receipts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON greige_yarn_receipts FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON greige_yarn_receipts FOR DELETE USING (auth.role() = 'authenticated');
