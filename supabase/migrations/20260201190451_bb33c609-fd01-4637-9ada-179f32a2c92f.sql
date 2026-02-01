-- Add sector allocations and top holdings columns to etf_allocations table
ALTER TABLE etf_allocations 
ADD COLUMN IF NOT EXISTS sector_allocations jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS top_holdings jsonb DEFAULT '[]'::jsonb;