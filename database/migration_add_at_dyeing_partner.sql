-- Migration: Add AT Dyeing Unit and update dyeing_order_forms status constraints

-- 1. Insert 'AT' as a Dyeing Unit partner if it doesn't already exist
INSERT INTO public.master_partners (partner_name, partner_type)
SELECT 'AT', 'Dyeing Unit'
WHERE NOT EXISTS (
    SELECT 1 FROM public.master_partners 
    WHERE partner_name = 'AT' AND partner_type = 'Dyeing Unit'
);

-- 2. Drop old status check constraint and add updated constraint supporting all states
ALTER TABLE public.dyeing_order_forms
  DROP CONSTRAINT IF EXISTS dyeing_order_forms_status_check;

ALTER TABLE public.dyeing_order_forms
  ADD CONSTRAINT dyeing_order_forms_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'partially_sent', 'fully_sent', 'partially_received', 'received'));
