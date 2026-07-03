-- ============================================================
-- Migration: Add DELETE Policy to Processing Finance Bills
-- ============================================================

DROP POLICY IF EXISTS "Allow authenticated users to delete processing bills" ON processing_finance_bills;
CREATE POLICY "Allow authenticated users to delete processing bills"
ON processing_finance_bills FOR DELETE
USING (auth.role() = 'authenticated');
