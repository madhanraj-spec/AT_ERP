-- Migration: Add Dyeing Unit partners master data

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
('SRI RAAM DYEING FACTORY', 'Dyeing Unit', '1/1-2, ANTHIYUR MAIN ROAD, KADAYAMPATTI', 'ERODE', 'TAMIL NADU', '33', '638312', '33AOKPG8387P1ZV'),
('MEENAKSHI DYEING', 'Dyeing Unit', '7/239, PALKARA KADU, AMANI KONDALAMPATTY', 'SALEM', 'TAMIL NADU', '33', '636010', '33ABXPM1005S1ZP'),
('ANNAMALAI SAYA SAALAI', 'Dyeing Unit', '38/2,10-D,KARUNGAL PATTY ITTERY ROAD,DADAGAPATTY', 'SALEM', 'TAMIL NADU', '33', '636006', '33AEPPS8272A1Z5'),
('R.K.DYEING', 'Dyeing Unit', '1/1E-2,ERUMAPALAYAM MAIN ROAD,KALARAMPATTY', 'SALEM', 'TAMIL NADU', '33', '636015', '33AAQFR8401L1Z9'),
('KINGBELLS DYEING', 'Dyeing Unit', '235/1,BHARATHIYAR STREET,RAMANATHAPURAM, AMMAPET', 'SALEM', 'TAMIL NADU', '33', '636003', '33AAKFK7544C1Z3'),
('UNITED SPINNING MILLS', 'Dyeing Unit', '2/311 NATTAMANGALAM ROAD, AMANIKONDALAMPATTY', 'SALEM', 'TAMIL NADU', '33', '636010', '33AACFU8472G1Z1'),
('SREE MOOKAMBIKAI DYERS', 'Dyeing Unit', 'NO.6/455, KOYYA THOPPU, AMMAPET', 'SALEM', 'TAMIL NADU', '33', '636003', '33ADDPS3948P1ZX'),
('DEIVEEGAM DYERS', 'Dyeing Unit', 'I 2-13, 5TH CROSS, INDUSTRIAL GROWTH CENTER, SIPCOT, PERUNDURAI', 'ERODE', 'TAMIL NADU', '33', '638052', '33AAMFD2415E1ZM'),
('VENKATESHWARA DENIM', 'Dyeing Unit', '45/B-1,NARAYANA NAGAR EAST,KOMARAPALAYAM', 'NAMAKKAL', 'TAMIL NADU', '33', '638183', '33AAFFV5542B1Z8'),
('SRI GOWRI SHANKAR', 'Dyeing Unit', '56/25,KARUNGALPATTY ITTERY ROAD,DADAGAPATTY', 'SALEM', 'TAMIL NADU', '33', '636006', '33AJQPS8294L1Z8')
ON CONFLICT (partner_name, partner_type) 
DO UPDATE SET 
    address = EXCLUDED.address,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    state_code = EXCLUDED.state_code,
    pincode = EXCLUDED.pincode,
    gstin = EXCLUDED.gstin;
