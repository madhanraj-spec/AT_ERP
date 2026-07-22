-- Migration: Add pincode to master_partners table
ALTER TABLE public.master_partners ADD COLUMN IF NOT EXISTS pincode TEXT;
