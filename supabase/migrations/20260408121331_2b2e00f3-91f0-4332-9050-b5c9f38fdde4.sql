-- Drop the unique constraint on (portfolio_id, underlying, strategy_type)
ALTER TABLE public.strategy_configurations
  DROP CONSTRAINT IF EXISTS strategy_configurations_portfolio_id_underlying_strategy_ty_key;

-- Add sort_order column to preserve strategy ordering
ALTER TABLE public.strategy_configurations
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;