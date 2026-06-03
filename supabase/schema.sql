-- Enable Row Level Security
alter default privileges in schema public grant all on tables to postgres, service_role;

-- 1. Profiles (Extends auth.users)
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  role text check (role in ('admin', 'merchandiser', 'greige_yarn', 'dyeing', 'operations', 'inspection', 'finance')),
  created_at timestamptz default now()
);

-- 2. Orders (Merchandiser)
create table orders (
  id uuid default gen_random_uuid() primary key,
  order_number serial,
  buyer_name text not null,
  order_date date not null default current_date,
  status text default 'draft' check (status in ('draft', 'confirmed', 'in_production', 'completed', 'dispatched')),
  merchandiser_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references orders(id) on delete cascade,
  fabric_specification text not null,
  design_specification text,
  quantity numeric not null, -- meters or kgs
  greige_yarn_requirement numeric, -- meters/kgs
  created_at timestamptz default now()
);

-- 3. Dyeing Orders
create table dyeing_orders (
  id uuid default gen_random_uuid() primary key,
  order_item_id uuid references order_items(id),
  color_code text not null,
  quantity numeric not null,
  status text default 'pending' check (status in ('pending', 'approved', 'in_process', 'completed')),
  created_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid references profiles(id)
);

-- 4. Inventory (Greige Yarn)
create table greige_yarn_stock (
  id uuid default gen_random_uuid() primary key,
  yarn_type text not null,
  quantity numeric default 0,
  location text
);

create table yarn_transactions (
  id uuid default gen_random_uuid() primary key,
  yarn_type text not null,
  transaction_type text check (transaction_type in ('in', 'out')),
  quantity numeric not null,
  source_destination text, -- e.g., 'spinning_mill', 'dyeing', 'weaving'
  reference_id uuid, -- could link to dyeing_order or order_item
  created_at timestamptz default now(),
  created_by uuid references profiles(id)
);

-- 5. Operations (Production Planning)
create table production_plans (
  id uuid default gen_random_uuid() primary key,
  order_item_id uuid references order_items(id),
  process_type text check (process_type in ('warping', 'sizing', 'weaving')),
  start_date date,
  end_date date,
  machine_id text,
  status text default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  notes text
);

-- 6. Fabric Rolls (Weaving Output)
create table fabric_rolls (
  id uuid default gen_random_uuid() primary key,
  production_plan_id uuid references production_plans(id), -- linked to weaving job
  roll_number text unique not null,
  length numeric not null,
  grade text,
  status text default 'woven' check (status in ('woven', 'inspected_raw', 'processing', 'finished', 'inspected_finish', 'dispatched')),
  created_at timestamptz default now()
);

-- 7. Inspections
create table inspections (
  id uuid default gen_random_uuid() primary key,
  roll_id uuid references fabric_rolls(id),
  inspector_id uuid references profiles(id),
  stage text check (stage in ('raw', 'finish')),
  points_1 numeric default 0,
  points_2 numeric default 0,
  points_3 numeric default 0,
  points_4 numeric default 0,
  total_points numeric generated always as (points_1 * 1 + points_2 * 2 + points_3 * 3 + points_4 * 4) stored,
  result text check (result in ('pass', 'fail', 'b_grade')),
  created_at timestamptz default now()
);


-- RLS Policies (Examples - User should enable RLS in dashboard)
alter table profiles enable row level security;
alter table orders enable row level security;
-- Policy: Merchandisers can only see their own orders
create policy "Merchandisers see own orders" on orders
  for select using (auth.uid() = merchandiser_id or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Policy: Admin sees all
create policy "Admins see all" on profiles
  for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Public read for roles (simplified for initial setup)
create policy "Public read profiles" on profiles for select using (true);
