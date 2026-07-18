-- Migration: Add fabric_inspection_reports table
CREATE TABLE IF NOT EXISTS fabric_inspection_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_number text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  rolls jsonb NOT NULL,
  meta_info jsonb NOT NULL,
  qty_unit text NOT NULL DEFAULT 'meters',
  avg_weight_meter numeric,
  total_rolls integer NOT NULL DEFAULT 0,
  total_qty numeric NOT NULL DEFAULT 0,
  total_weight numeric NOT NULL DEFAULT 0
);

-- Enable Row Level Security (RLS)
ALTER TABLE fabric_inspection_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform all operations
DROP POLICY IF EXISTS "Allow authenticated users all actions" ON fabric_inspection_reports;
CREATE POLICY "Allow authenticated users all actions" 
ON fabric_inspection_reports FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');
