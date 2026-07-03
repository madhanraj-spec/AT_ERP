-- ============================================================
-- Migration: Add Reprocessing & Rewash Orders
-- ============================================================

-- Main Table for Fabric Reprocessing (Rewash) Orders
CREATE TABLE IF NOT EXISTS processing_reprocess_orders (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parent_pof_id         UUID REFERENCES processing_orders(id) ON DELETE CASCADE,
  pof_number            TEXT NOT NULL,
  partner_id            UUID REFERENCES master_partners(id) ON DELETE CASCADE,
  partner_name          TEXT NOT NULL,
  dc_number             TEXT UNIQUE NOT NULL,             -- e.g. "AT/2026/POF/00001/rw/0001"
  delivery_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  person_name           TEXT NOT NULL,
  
  -- JSONB list of rolls sent back
  -- Array of: { id, qty, greige_roll_id, design_no, design_name, order_number }
  rolls                 JSONB NOT NULL DEFAULT '[]',
  
  -- JSONB list of received rolls (includes new roll IDs, received qty, etc.)
  received_rolls        JSONB NOT NULL DEFAULT '[]',
  pofrr_number          TEXT UNIQUE,
  
  status                TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'received')),
  payment_status        TEXT NOT NULL DEFAULT 'no_bill' CHECK (payment_status IN ('no_bill', 'submitted_for_approval', 'approved', 'settled')),
  bill_id               UUID REFERENCES processing_finance_bills(id) ON DELETE SET NULL,
  allot_to_billing      BOOLEAN NOT NULL DEFAULT FALSE,
  
  received_by           TEXT,
  receive_vehicle_details TEXT,
  received_place        TEXT,
  received_at           TIMESTAMP WITH TIME ZONE,
  
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pro_parent_pof ON processing_reprocess_orders(parent_pof_id);
CREATE INDEX IF NOT EXISTS idx_pro_dc_number ON processing_reprocess_orders(dc_number);
CREATE INDEX IF NOT EXISTS idx_pro_status ON processing_reprocess_orders(status);
CREATE INDEX IF NOT EXISTS idx_pro_allot ON processing_reprocess_orders(allot_to_billing);

-- Enable RLS
ALTER TABLE processing_reprocess_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow authenticated read reprocess orders" ON processing_reprocess_orders;
CREATE POLICY "Allow authenticated read reprocess orders" ON processing_reprocess_orders
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated insert reprocess orders" ON processing_reprocess_orders;
CREATE POLICY "Allow authenticated insert reprocess orders" ON processing_reprocess_orders
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update reprocess orders" ON processing_reprocess_orders;
CREATE POLICY "Allow authenticated update reprocess orders" ON processing_reprocess_orders
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated delete reprocess orders" ON processing_reprocess_orders;
CREATE POLICY "Allow authenticated delete reprocess orders" ON processing_reprocess_orders
    FOR DELETE USING (auth.role() = 'authenticated');

-- Alter processing_finance_bills to support linking multiple reprocess order IDs
ALTER TABLE processing_finance_bills ADD COLUMN IF NOT EXISTS selected_reprocess_ids UUID[] DEFAULT '{}'::uuid[];
