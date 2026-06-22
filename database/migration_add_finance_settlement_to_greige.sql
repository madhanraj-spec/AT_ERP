-- Migration: Add finance settlement tracking to greige_yarn_receipts
-- This enables Admin to settle GYRR invoices in the Finances module

ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS finance_settlement_status TEXT DEFAULT 'pending' CHECK (finance_settlement_status IN ('pending', 'settled'));
ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS finance_settled_by UUID REFERENCES profiles(id);
ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS finance_settled_at TIMESTAMP WITH TIME ZONE;

-- Index for fast filtering by settlement status
CREATE INDEX IF NOT EXISTS idx_gyr_finance_settlement_status ON greige_yarn_receipts(finance_settlement_status);
