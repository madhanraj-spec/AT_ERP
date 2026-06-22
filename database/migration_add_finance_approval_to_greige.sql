-- Migration: Add finance approval tracking to greige_yarn_receipts
-- This enables Admin to approve GYRR receipts for finance processing

ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS finance_approval_status TEXT DEFAULT 'pending' CHECK (finance_approval_status IN ('pending', 'approved'));
ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS finance_approved_by UUID REFERENCES profiles(id);
ALTER TABLE greige_yarn_receipts ADD COLUMN IF NOT EXISTS finance_approved_at TIMESTAMP WITH TIME ZONE;

-- Index for fast filtering by approval status
CREATE INDEX IF NOT EXISTS idx_gyr_finance_approval_status ON greige_yarn_receipts(finance_approval_status);
