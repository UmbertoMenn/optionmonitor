-- Add exchange_rate column to positions table
ALTER TABLE public.positions 
ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT NULL;