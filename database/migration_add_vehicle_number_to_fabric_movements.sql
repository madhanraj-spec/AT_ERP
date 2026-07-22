-- Migration: Add vehicle_number column to fabric_movements
-- Vehicle number is entered during challan creation to track transport vehicle details

ALTER TABLE public.fabric_movements
ADD COLUMN IF NOT EXISTS vehicle_number TEXT;

COMMENT ON COLUMN public.fabric_movements.vehicle_number IS 'Vehicle number of the transport vehicle carrying the fabric rolls';
