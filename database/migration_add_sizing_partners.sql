-- Migration: Add Sizing Unit partner master data

ALTER TABLE public.master_partners ADD COLUMN IF NOT EXISTS district TEXT;

-- Ensure unique constraint on (partner_name, partner_type) exists for ON CONFLICT clause
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'master_partners_partner_name_partner_type_key'
    ) THEN
        ALTER TABLE public.master_partners ADD CONSTRAINT master_partners_partner_name_partner_type_key UNIQUE (partner_name, partner_type);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN others THEN NULL;
END $$;

INSERT INTO public.master_partners (partner_name, partner_type, address, district, state, state_code, pincode, gstin)
VALUES
('VEDHANAYAKI SIZING MILLS', 'Sizing Unit', '42-A,Thanneerpandhal palayam,Sathy Road', 'ERODE', 'TAMIL NADU', '33', '638004', '33AEUPD6368J1Z1')
ON CONFLICT (partner_name, partner_type) 
DO UPDATE SET 
    address = EXCLUDED.address,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    state_code = EXCLUDED.state_code,
    pincode = EXCLUDED.pincode,
    gstin = EXCLUDED.gstin;
