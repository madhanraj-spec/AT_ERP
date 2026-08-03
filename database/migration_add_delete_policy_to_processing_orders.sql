-- ============================================================
-- Migration: Add DELETE Policy to processing_orders
-- ============================================================

DROP POLICY IF EXISTS "Allow authenticated delete processing orders" ON public.processing_orders;

CREATE POLICY "Allow authenticated delete processing orders" ON public.processing_orders
    FOR DELETE USING (auth.role() = 'authenticated');
