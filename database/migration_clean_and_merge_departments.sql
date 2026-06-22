-- Migration to clean and merge duplicate departments, ensuring only exact: Warping, Sizing, Yarn, Weaving, Inspection
-- 1. Ensure the standard department names exist in master_departments table
INSERT INTO master_departments (department_name) VALUES ('Warping') ON CONFLICT (department_name) DO NOTHING;
INSERT INTO master_departments (department_name) VALUES ('Sizing') ON CONFLICT (department_name) DO NOTHING;
INSERT INTO master_departments (department_name) VALUES ('Yarn') ON CONFLICT (department_name) DO NOTHING;
INSERT INTO master_departments (department_name) VALUES ('Weaving') ON CONFLICT (department_name) DO NOTHING;
INSERT INTO master_departments (department_name) VALUES ('Inspection') ON CONFLICT (department_name) DO NOTHING;

-- 2. Merge and delete duplicates dynamically
DO $$
DECLARE
    target_id UUID;
    dup_id UUID;
BEGIN
    -- --- Merge Sizing duplicates ---
    SELECT id INTO target_id FROM master_departments WHERE department_name = 'Sizing';
    FOR dup_id IN 
        SELECT id FROM master_departments 
        WHERE department_name ILIKE '%sizing%' AND id <> target_id
    LOOP
        UPDATE master_machines SET department_id = target_id WHERE department_id = dup_id;
        UPDATE master_workers SET department_id = target_id WHERE department_id = dup_id;
        DELETE FROM master_departments WHERE id = dup_id;
    END LOOP;

    -- --- Merge Warping duplicates ---
    SELECT id INTO target_id FROM master_departments WHERE department_name = 'Warping';
    FOR dup_id IN 
        SELECT id FROM master_departments 
        WHERE department_name ILIKE '%warping%' AND id <> target_id
    LOOP
        UPDATE master_machines SET department_id = target_id WHERE department_id = dup_id;
        UPDATE master_workers SET department_id = target_id WHERE department_id = dup_id;
        DELETE FROM master_departments WHERE id = dup_id;
    END LOOP;

    -- --- Merge Weaving duplicates ---
    SELECT id INTO target_id FROM master_departments WHERE department_name = 'Weaving';
    FOR dup_id IN 
        SELECT id FROM master_departments 
        WHERE department_name ILIKE '%weaving%' AND id <> target_id
    LOOP
        UPDATE master_machines SET department_id = target_id WHERE department_id = dup_id;
        UPDATE master_workers SET department_id = target_id WHERE department_id = dup_id;
        DELETE FROM master_departments WHERE id = dup_id;
    END LOOP;

    -- --- Merge Inspection duplicates ---
    SELECT id INTO target_id FROM master_departments WHERE department_name = 'Inspection';
    FOR dup_id IN 
        SELECT id FROM master_departments 
        WHERE department_name ILIKE '%inspection%' AND id <> target_id
    LOOP
        UPDATE master_machines SET department_id = target_id WHERE department_id = dup_id;
        UPDATE master_workers SET department_id = target_id WHERE department_id = dup_id;
        DELETE FROM master_departments WHERE id = dup_id;
    END LOOP;

    -- --- Merge Yarn duplicates ---
    SELECT id INTO target_id FROM master_departments WHERE department_name = 'Yarn';
    FOR dup_id IN 
        SELECT id FROM master_departments 
        WHERE department_name ILIKE '%yarn%' AND id <> target_id
    LOOP
        UPDATE master_machines SET department_id = target_id WHERE department_id = dup_id;
        UPDATE master_workers SET department_id = target_id WHERE department_id = dup_id;
        DELETE FROM master_departments WHERE id = dup_id;
    END LOOP;

    -- --- Delete any other departments that do not match the standard five list ---
    FOR dup_id IN
        SELECT id FROM master_departments
        WHERE department_name NOT IN ('Warping', 'Sizing', 'Weaving', 'Inspection', 'Yarn')
    LOOP
        DELETE FROM master_departments WHERE id = dup_id;
    END LOOP;

END $$;
