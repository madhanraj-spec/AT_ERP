-- ============================================================
-- Dyeing Order Form (DOF) Schema
-- ============================================================

-- DOF Number generator: AT/YYYY/DOF/00001
CREATE OR REPLACE FUNCTION get_next_dof_number(p_year int)
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_next_val int;
  v_dof_number text;
BEGIN
  v_prefix := 'AT/' || p_year || '/DOF/';

  SELECT COALESCE(MAX(CAST(SUBSTRING(dof_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_next_val
  FROM dyeing_order_forms
  WHERE dof_number LIKE v_prefix || '%';

  v_dof_number := v_prefix || LPAD(v_next_val::text, 5, '0');
  RETURN v_dof_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Main Table
-- ============================================================
CREATE TABLE IF NOT EXISTS dyeing_order_forms (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dof_number            TEXT UNIQUE,
  created_by            UUID REFERENCES profiles(id) NOT NULL,
  dyeing_unit_id        UUID REFERENCES master_partners(id),
  expected_delivery_date DATE,

  -- Array of order IDs linked to this DOF
  order_ids             UUID[],

  -- JSONB: { countId, colour, type (warp/weft), orderId, base_kg, excess_pct, total_kg }[]
  yarn_allocations      JSONB NOT NULL DEFAULT '[]',

  -- JSONB: summary { countId, colour, total_kg }[]
  summary               JSONB NOT NULL DEFAULT '[]',

  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by           UUID REFERENCES profiles(id),
  approval_notes        TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dof_created_by   ON dyeing_order_forms(created_by);
CREATE INDEX IF NOT EXISTS idx_dof_status        ON dyeing_order_forms(status);
CREATE INDEX IF NOT EXISTS idx_dof_created_at    ON dyeing_order_forms(created_at DESC);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE dyeing_order_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchandiser sees own DOFs" ON dyeing_order_forms;
CREATE POLICY "Merchandiser sees own DOFs" ON dyeing_order_forms FOR SELECT USING (
  auth.uid() = created_by OR
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Merchandiser can create DOFs" ON dyeing_order_forms;
CREATE POLICY "Merchandiser can create DOFs" ON dyeing_order_forms FOR INSERT WITH CHECK (
  auth.uid() = created_by
);

DROP POLICY IF EXISTS "Admin can update DOFs" ON dyeing_order_forms;
CREATE POLICY "Admin can update DOFs" ON dyeing_order_forms FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
