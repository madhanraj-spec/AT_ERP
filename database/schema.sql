-- Supabase DB Schema Setup for Fabric Manufacturing ERP

-- Set up enum types for status tracking
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('pending', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'active';

DO $$ BEGIN CREATE TYPE job_status AS ENUM ('pending', 'scheduled', 'in_progress', 'completed', 'failed_qc'); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin', 'merchandiser', 'greige_yarn', 'dyed_yarn', 'warping_sizing', 'weaving', 'production', 'inspection', 'dispatch'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. Users/Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS for Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
-- Admin can manage all profiles
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- 2. Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_type TEXT NOT NULL, -- 'greige_yarn', 'dyed_yarn', 'warp', 'sized_warp', 'fabric'
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL, -- 'kg', 'meters', 'rolls'
  lot_number TEXT,
  location TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Orders (Created by Merchandiser)
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number TEXT UNIQUE,
  order_type TEXT CHECK (order_type IN ('bulk', 'sample')),
  merchandiser_id UUID REFERENCES profiles(id) NOT NULL,
  merchandiser_name TEXT,
  buyer_id UUID REFERENCES master_brands(id),
  design_no TEXT,
  design_name TEXT,
  vendor_id UUID REFERENCES master_partners(id),
  season TEXT,
  fob_date DATE,
  dispatch_date DATE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  technical_specs JSONB, -- stores warps, wefts, reed, pick, width, weave_type
  yarn_requirements JSONB, -- stores count, color, kg details
  total_quantity NUMERIC NOT NULL DEFAULT 0,
  status order_status DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- Merchandisers can see their own orders, Admins can see all.
DROP POLICY IF EXISTS "Merchandisers see own orders" ON orders;
CREATE POLICY "Merchandisers see own orders" ON orders FOR SELECT USING (
  auth.uid() = merchandiser_id OR 
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
DROP POLICY IF EXISTS "Merchandisers can insert own orders" ON orders;
CREATE POLICY "Merchandisers can insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = merchandiser_id);
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
CREATE POLICY "Admins can update orders" ON orders FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR auth.uid() = merchandiser_id
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_merchandiser_id ON orders(merchandiser_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 4. Forms and Approvals (Dyeing, Warping, etc.)
CREATE TABLE IF NOT EXISTS production_forms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) NOT NULL,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  form_type TEXT NOT NULL, -- 'dyeing', 'warping', 'sizing', 'weaving'
  details JSONB NOT NULL, -- Contains specifics like color, counts, instructions
  status order_status DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Production Jobs
CREATE TABLE IF NOT EXISTS production_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  form_id UUID REFERENCES production_forms(id) NOT NULL,
  job_type TEXT NOT NULL, -- 'dyeing', 'warping', 'sizing', 'weaving'
  assigned_to UUID REFERENCES profiles(id), -- Nullable, assignment to specific user or external vendor
  vendor_name TEXT, -- Optional, if job work
  qty_issued NUMERIC,
  qty_received NUMERIC,
  status job_status DEFAULT 'pending',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Inspections
CREATE TABLE IF NOT EXISTS inspections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES production_jobs(id) NOT NULL,
  inspector_id UUID REFERENCES profiles(id) NOT NULL,
  item_id UUID REFERENCES inventory_items(id), -- the fabric roll generated
  passed BOOLEAN NOT NULL,
  grade TEXT, -- 'A', 'B', 'Reject'
  defects TEXT,
  inspected_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
