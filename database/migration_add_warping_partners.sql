-- Migration: Add Warping Unit partners master data

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
('ANBU WARPING CENTRE', 'Warping Unit', '5/36,KATTUR,(NEAR MARIAMMAN KOVIL),AMANI KONDALAMPATTI,NATTAMANGALAM(PO)', 'SALEM', 'TAMIL NADU', '33', '636010', '33AZRFS4981N1Z8'),
('SRI JOTHI WARPING UNIT', 'Warping Unit', '2/1 RAMAKRISNA ROAD,LINE ROAD EAST,GUGAI', 'SALEM', 'TAMIL NADU', '33', '636006', '33AAQHS4184K1ZX'),
('MANIMALAR FABRICRS', 'Warping Unit', '8/34,GANDHI NAGAR,IRUSANAMPATTI ROAD,ATTAYAMPATTI', 'SALEM', 'TAMIL NADU', '33', '637501', '33AEAPP2721B1Z9')
ON CONFLICT (partner_name, partner_type) 
DO UPDATE SET 
    address = EXCLUDED.address,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    state_code = EXCLUDED.state_code,
    pincode = EXCLUDED.pincode,
    gstin = EXCLUDED.gstin;
