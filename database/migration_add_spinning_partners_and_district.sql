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
('UNITED SPINNING MILLS', 'Spinning Mill', '2/311, NATTAMANGALAM ROAD, AMMANIKONDALAMPATTY', 'SALEM', 'TAMIL NADU', '33', '636010', '33AACFU8472G1Z1'),
('GUNTUR SPINNING MILLS', 'Spinning Mill', 'N.H.5, Behind Hotel Hyna, Obulanaidu Palem', 'Guntur', 'Andhra Pradesh', '37', '522005', '37AACCG4213G1ZD'),
('SAMBANDAM SPINNING MILLS', 'Spinning Mill', 'Kamaraj Nagar Colony, Ammapet, Salem', 'SALEM', 'TAMIL NADU', '33', '636014', '33AACCS3614G1ZH'),
('P.K.P.N SPINNING MILLS (P) LTD', 'Spinning Mill', 'SANKARIMAIN ROAD, SOWDHAPURAM KOMARAPALAYAM TK', 'NAMAKKAL', 'TAMIL NADU', '33', '638008', '33AABCP5019K1Z'),
('S P SPINNING MILLS', 'Spinning Mill', 'New No. 1/231 (Old No. 1/147/104), Cuddalore Main Road, Karipatti', 'Salem', 'TAMIL NADU', '33', '636106', '33AACCS9501G1ZF'),
('SASI ANAND SPINNING MILLS', 'Spinning Mill', '9/1 & 30/1. Thingalore Road, Mettupudur Village, Perundurai', 'Erode', 'TAMIL NADU', '33', '638057', '33AACS764601ZF'),
('P.K. LAXMI MILL INDIA PRIVATE LIMITED', 'Spinning Mill', 'SF 473/3, GARIUR ROAD, MINUKKAMPATTI PO, VEDASANDUR(TK), Dindigul', 'Dindigul', 'TAMIL NADU', '33', '624711', '33AACCE2985R1Z2'),
('K.T.SPINNING MILLS (P) LTD', 'Spinning Mill', '4/98. Veerasam Main Road, Valasiyur, Salem', 'Salem', 'TAMIL NADU', '33', '636122', '33AABCK7898C1Z2'),
('MOTHI SPINNER PRIVATE LIMITED', 'Spinning Mill', 'No. 108, Komarapalayam Main Road, Pallipalayam, Tiruchengode', 'Namakkal', 'TAMIL NADU', '33', '638006', '33AACCM2586Q1Z9'),
('Top Light Textiles Private Limited', 'Spinning Mill', 'SF No 337,338 Neelipalayam, Nochikuttai(po), Punjai Puliyampattai(Via), Coimbatore', 'Coimbatore', 'TAMIL NADU', '33', '638459', '33AACCT0899T120'),
('Sri Saravana Mills Pvt Ltd', 'Spinning Mill', 'Bellingundu Road, Pithalaipatty', 'Dindigul', 'TAMIL NADU', '33', '624002', '33AACCS0546D1ZW'),
('SIVARAJ SPINNING MILLS (P) LTD', 'Spinning Mill', 'NO 1752, 1753, , KOOTTUR, AGARAM VILLAGE,', 'Dindigul', 'TAMIL NADU', '33', '624709', '33AACCS0681H1Z3'),
('AWAYA NAAZ SYED UMAR GULION', 'Spinning Mill', '198-1, 2nd WEST STREET, LINE ROAD', 'SALEM', 'TAMIL NADU', '33', '636006', '33AWPSG6907H1Z5'),
('SRI JAYAJOTHI AND COMPANY PRIVATE LIMITED', 'Spinning Mill', 'UNIT I : 70 - Alagai Nagar Rajapalayam', 'VIRUDHUNAGAR', 'TAMIL NADU', '33', '626117', '33AACCS0542E1ZY'),
('DHANANDSHANA SPINNING MILLS PVT LTD', 'Spinning Mill', 'DOOR 8-1 ANANGUR ROAD KOMARAPALAYAM ASURAMAM VILLAGE , KOMARAANLAYAM', 'NAMAKKAL', 'TAMIL NADU', '33', '638051', '33AACCD7942F1ZV'),
('CHENDHOOR MURUGHAN YARN TEX INDIA PRIVATE LIMITED', 'Spinning Mill', 'S.F. No: 153/2, Voppadal to Kamarajapalam Road, Komarapalayam T.k., Mettukadu', 'NAMAKKAL', 'TAMIL NADU', '33', '638005', '33AACBC1904M1ZH'),
('JYOTIRMAYE TEXTILES PVT LTD', 'Spinning Mill', 'Office: 3rd Floor, 5-80-4,Dr Kalpan Complex 1st Lane, Ashok Nagar. Factory: 41/1 1, Guntur Road .Senjivaru', 'Guntur', 'Andhra Pradesh', '37', '522007', '37AACCJ2751L1ZD'),
('SPACE TEXTILES PRIVATE LIMITED (UNIT:SCM TEXTILES SPINNERS)', 'Spinning Mill', 'S.F.NO.89, N.G.PALAYAM PUDUR,THEKKALUR AVINASHI', 'TIRUPUR', 'TAMIL NADU', '33', '641654', '33AACCS0757M1ZO'),
('SRI JAYAJOTHI AND COMPANY PRIVATE LIMITED O.E. DIVISION', 'Spinning Mill', '4/713, Industrial Estate RD, SULAKARAI', 'Virudhunagar', 'TAMIL NADU', '33', '626003', '33AACCS0542E1ZY'),
('ARUN TEXTILES (P) LTD', 'Spinning Mill', 'S.F.NO 1182,Thasampalayam, Polanaikkalapalayam(P.O) Gobichettipalayam', 'Erode', 'TAMIL NADU', '33', '638476', '33AACCA9992G1ZR'),
('SCM MILLS', 'Spinning Mill', 'SF NO 90/1-13,371/1-5, AKKARAIPALAYAM ROAD THANGALINI VILLAGE, KOLAPPALUR, GOBICHETTIPALAYAM', 'Erode', 'TAMIL NADU', '33', '638456', '33AAABC67104P1ZE'),
('Shreedhar Spinners Limited', 'Spinning Mill', 'T-15 Additional Amravati Industrial Area, Textile Zone, Nandgaon', 'Nandgaon', 'Maharashtra', '27', '444901', '27ABCSD0600S1ZA'),
('Suchitra Yarn Traders', 'Spinning Mill', '488/10, Puthur Agraharam Nellikarapatty', 'Salem', 'TAMIL NADU', '33', '636010', '33AAEFF8204L1Z4'),
('Sundaram Yarns', 'Spinning Mill', '21,Dakshinamoorthy Hotel Back Side, Ramalingam Madalayam Street, Gugai', 'Salem', 'TAMIL NADU', '33', '636006', '33AADYM8179P1Z9'),
('KUMARAGIRI SPINNERS (P) LTD', 'Spinning Mill', 'No:391,392 , Kuttakadu, Valrajapalayam SanniyasipattiAgraharam(PO) Komarapalayam(TK)', 'NAMAKKAL', 'TAMIL NADU', '33', '637304', '33AACCK4373M1ZC'),
('LUCKY YARN TEX INDIA PRIVATE LIMITED', 'Spinning Mill', 'Mills At: S.F.No:15/2, Anangur Road, Nattawelampalayam,Tiruchengode', 'Erode', 'TAMIL NADU', '33', '637304', '33AABCL2519H1ZV')
ON CONFLICT (partner_name, partner_type) 
DO UPDATE SET 
    address = EXCLUDED.address,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    state_code = EXCLUDED.state_code,
    pincode = EXCLUDED.pincode,
    gstin = EXCLUDED.gstin;
