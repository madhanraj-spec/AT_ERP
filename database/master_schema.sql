-- Master Data Schema for AT Fabric ERP

CREATE TABLE IF NOT EXISTS master_yarn_counts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    count_value TEXT NOT NULL,
    material TEXT NOT NULL,
    product_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(count_value, material, product_type)
);

CREATE TABLE IF NOT EXISTS master_brands (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    brand_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS master_partners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    partner_name TEXT NOT NULL,
    partner_type TEXT NOT NULL, -- e.g. 'Spinning', 'Weaving', 'Dyeing'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(partner_name, partner_type)
);

CREATE TABLE IF NOT EXISTS master_departments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    department_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS master_machines (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    machine_name TEXT NOT NULL,
    department_id UUID REFERENCES master_departments(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK (scope IN ('in_house', 'job_work')),
    partner_id UUID REFERENCES master_partners(id), -- Only set if scope is job_work
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(machine_name, department_id, scope)
);

CREATE TABLE IF NOT EXISTS master_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    warehouse_type TEXT NOT NULL, -- e.g. 'greige_warehouse', 'dyed_yarn_warehouse'
    location_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(warehouse_type, location_name)
);

CREATE TABLE IF NOT EXISTS master_beams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    beam_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for all masters so users can securely access them inside Supabase queries
ALTER TABLE master_yarn_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_beams ENABLE ROW LEVEL SECURITY;

-- Set up generic read/write policies for staff users over Masters
-- This ensures anyone logged into the App can read Master data (for dropdowns) and Admin/Production can configure them.
CREATE POLICY "Allow authenticated read" ON master_yarn_counts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON master_yarn_counts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON master_brands FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON master_brands FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON master_partners FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON master_partners FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON master_departments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON master_departments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON master_machines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON master_machines FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON master_locations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON master_locations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read" ON master_beams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON master_beams FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Enable Delete capability for Master Data
CREATE POLICY "Allow authenticated delete" ON master_yarn_counts FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON master_brands FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON master_partners FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON master_departments FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON master_machines FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON master_locations FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON master_beams FOR DELETE USING (auth.role() = 'authenticated');
