-- Migration: Add forwarded_to and Weaving details to sizing_order_forms
ALTER TABLE sizing_order_forms
ADD COLUMN IF NOT EXISTS forwarded_to TEXT CHECK (forwarded_to IN ('weaving')),
ADD COLUMN IF NOT EXISTS weaving_type TEXT CHECK (weaving_type IN ('in_house', 'job_work')),
ADD COLUMN IF NOT EXISTS weaving_machine_id UUID REFERENCES master_machines(id),
ADD COLUMN IF NOT EXISTS weaving_machine_name TEXT,
ADD COLUMN IF NOT EXISTS weaving_partner_id UUID REFERENCES master_partners(id),
ADD COLUMN IF NOT EXISTS weaving_partner_name TEXT,
ADD COLUMN IF NOT EXISTS weaving_start_date DATE,
ADD COLUMN IF NOT EXISTS weaving_end_date DATE;
