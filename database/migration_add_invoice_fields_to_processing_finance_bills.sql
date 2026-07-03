-- Alter processing_finance_bills to add partner invoice number and date
ALTER TABLE processing_finance_bills ADD COLUMN IF NOT EXISTS partner_invoice_no TEXT;
ALTER TABLE processing_finance_bills ADD COLUMN IF NOT EXISTS partner_invoice_date DATE;
