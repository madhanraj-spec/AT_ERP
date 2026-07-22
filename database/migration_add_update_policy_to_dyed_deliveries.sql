-- Migration: Add UPDATE policy to dyed_yarn_deliveries table
DROP POLICY IF EXISTS "dydr_update" ON dyed_yarn_deliveries;
CREATE POLICY "dydr_update" ON dyed_yarn_deliveries FOR UPDATE USING (auth.role() = 'authenticated');
