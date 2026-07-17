-- ============================================================
-- Migration: Update Dispatch Module for Multi-Order Billing & Invoicing
-- ============================================================

-- Add status to package slips (created or dispatched)
ALTER TABLE dispatch_package_slips ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'created' NOT NULL;

-- Add billing and transporter fields to dispatch_bills
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS billed_from_address TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS billed_to_address TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS shipped_from_address TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS shipped_to_address TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS transport_name TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS transport_mode TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS freight_type TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS lr_no TEXT;
ALTER TABLE dispatch_bills ADD COLUMN IF NOT EXISTS lr_date DATE;
