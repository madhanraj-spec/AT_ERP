-- Migration: Update Dyeing Order Form statuses to support receiving workflow
ALTER TABLE dyeing_order_forms
  DROP CONSTRAINT IF EXISTS dyeing_order_forms_status_check;

ALTER TABLE dyeing_order_forms
  ADD CONSTRAINT dyeing_order_forms_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'partially_received', 'received'));
