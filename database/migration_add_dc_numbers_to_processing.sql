-- ============================================================
-- AT Fabric ERP: Add Processing DC Numbers to Processing Orders
-- ============================================================

-- Add processing_dc_numbers TEXT[] to processing_orders to link multiple DC numbers
ALTER TABLE public.processing_orders 
ADD COLUMN IF NOT EXISTS processing_dc_numbers TEXT[] DEFAULT '{}'::text[];

-- Create an index for faster lookups on DC numbers array
CREATE INDEX IF NOT EXISTS idx_po_dc_numbers ON public.processing_orders USING GIN(processing_dc_numbers);
