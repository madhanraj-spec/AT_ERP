-- Migration: Add avg_weight_meter to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS avg_weight_meter NUMERIC;
