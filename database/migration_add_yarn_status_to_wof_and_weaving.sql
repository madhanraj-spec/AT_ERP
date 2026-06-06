-- ============================================================
-- AT Fabric ERP: Add yarn_status to Warping & Weaving Orders
-- Run this in Supabase Studio SQL Editor
-- ============================================================

ALTER TABLE warping_order_forms 
ADD COLUMN IF NOT EXISTS yarn_status TEXT DEFAULT 'not_delivered';

ALTER TABLE weaving_orders 
ADD COLUMN IF NOT EXISTS yarn_status TEXT DEFAULT 'not_delivered';

CREATE INDEX IF NOT EXISTS idx_wof_yarn_status ON warping_order_forms(yarn_status);
CREATE INDEX IF NOT EXISTS idx_weaving_yarn_status ON weaving_orders(yarn_status);
