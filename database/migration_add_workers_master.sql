-- Migration to add workers master table and default departments

-- Create master_workers table
CREATE TABLE IF NOT EXISTS master_workers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    worker_name TEXT NOT NULL,
    department_id UUID REFERENCES master_departments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(worker_name, department_id)
);

-- Enable RLS
ALTER TABLE master_workers ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Allow authenticated read" ON master_workers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert" ON master_workers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON master_workers FOR DELETE USING (auth.role() = 'authenticated');

-- Seed and merge master_departments with standard names: Warping, Sizing, Weaving, Inspection, Yarn

-- Warping
DO $$
DECLARE
    target_id UUID;
    old_id UUID;
BEGIN
    INSERT INTO master_departments (department_name)
    VALUES ('Warping')
    ON CONFLICT (department_name) DO NOTHING;
    
    SELECT id INTO target_id FROM master_departments WHERE department_name = 'Warping';
    SELECT id INTO old_id FROM master_departments WHERE department_name = 'Warping Department';
    
    IF old_id IS NOT NULL AND target_id IS NOT NULL AND old_id <> target_id THEN
        UPDATE master_machines SET department_id = target_id WHERE department_id = old_id;
        UPDATE master_workers SET department_id = target_id WHERE department_id = old_id;
        DELETE FROM master_departments WHERE id = old_id;
    END IF;
END $$;

-- Sizing
DO $$
DECLARE
    target_id UUID;
    old_id UUID;
BEGIN
    INSERT INTO master_departments (department_name)
    VALUES ('Sizing')
    ON CONFLICT (department_name) DO NOTHING;
    
    SELECT id INTO target_id FROM master_departments WHERE department_name = 'Sizing';
    SELECT id INTO old_id FROM master_departments WHERE department_name = 'Sizing Department';
    
    IF old_id IS NOT NULL AND target_id IS NOT NULL AND old_id <> target_id THEN
        UPDATE master_machines SET department_id = target_id WHERE department_id = old_id;
        UPDATE master_workers SET department_id = target_id WHERE department_id = old_id;
        DELETE FROM master_departments WHERE id = old_id;
    END IF;
END $$;

-- Weaving
DO $$
DECLARE
    target_id UUID;
    old_id UUID;
BEGIN
    INSERT INTO master_departments (department_name)
    VALUES ('Weaving')
    ON CONFLICT (department_name) DO NOTHING;
    
    SELECT id INTO target_id FROM master_departments WHERE department_name = 'Weaving';
    SELECT id INTO old_id FROM master_departments WHERE department_name = 'Weaving Department';
    
    IF old_id IS NOT NULL AND target_id IS NOT NULL AND old_id <> target_id THEN
        UPDATE master_machines SET department_id = target_id WHERE department_id = old_id;
        UPDATE master_workers SET department_id = target_id WHERE department_id = old_id;
        DELETE FROM master_departments WHERE id = old_id;
    END IF;
END $$;

-- Inspection
DO $$
DECLARE
    target_id UUID;
    old_id UUID;
BEGIN
    INSERT INTO master_departments (department_name)
    VALUES ('Inspection')
    ON CONFLICT (department_name) DO NOTHING;
    
    SELECT id INTO target_id FROM master_departments WHERE department_name = 'Inspection';
    SELECT id INTO old_id FROM master_departments WHERE department_name = 'Inspection Department';
    
    IF old_id IS NOT NULL AND target_id IS NOT NULL AND old_id <> target_id THEN
        UPDATE master_machines SET department_id = target_id WHERE department_id = old_id;
        UPDATE master_workers SET department_id = target_id WHERE department_id = old_id;
        DELETE FROM master_departments WHERE id = old_id;
    END IF;
END $$;

-- Yarn
DO $$
DECLARE
    target_id UUID;
    old_id UUID;
BEGIN
    INSERT INTO master_departments (department_name)
    VALUES ('Yarn')
    ON CONFLICT (department_name) DO NOTHING;
    
    SELECT id INTO target_id FROM master_departments WHERE department_name = 'Yarn';
    SELECT id INTO old_id FROM master_departments WHERE department_name = 'Yarn Department';
    
    IF old_id IS NOT NULL AND target_id IS NOT NULL AND old_id <> target_id THEN
        UPDATE master_machines SET department_id = target_id WHERE department_id = old_id;
        UPDATE master_workers SET department_id = target_id WHERE department_id = old_id;
        DELETE FROM master_departments WHERE id = old_id;
    END IF;
END $$;
