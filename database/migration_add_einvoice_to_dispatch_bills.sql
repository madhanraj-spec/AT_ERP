-- Add E-Invoice columns to dispatch_bills table
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS einvoice_irn TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS einvoice_ack_no TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS einvoice_ack_date TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS einvoice_status TEXT DEFAULT 'pending'; -- 'pending', 'generated', 'failed', 'cancelled'
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS einvoice_error TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS einvoice_details JSONB;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS einvoice_qr_code TEXT;
