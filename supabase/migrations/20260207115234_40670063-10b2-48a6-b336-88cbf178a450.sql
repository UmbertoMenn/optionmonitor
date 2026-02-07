-- Create strategy_cache table to store frontend-computed strategies
CREATE TABLE public.strategy_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  strategy_key TEXT NOT NULL,
  strategy_type TEXT NOT NULL,
  underlying TEXT NOT NULL,
  ticker TEXT,
  position_ids TEXT[] NOT NULL,
  sold_put_strike NUMERIC,
  sold_call_strike NUMERIC,
  bought_put_strike NUMERIC,
  bought_call_strike NUMERIC,
  is_range_strategy BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, strategy_key)
);

-- Enable RLS
ALTER TABLE public.strategy_cache ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read their own portfolio's strategies
CREATE POLICY "Users can read own strategies"
  ON public.strategy_cache
  FOR SELECT
  USING (portfolio_id IN (
    SELECT id FROM public.portfolios WHERE user_id = auth.uid()
  ));

-- RLS: Users can insert/update their own portfolio's strategies
CREATE POLICY "Users can insert own strategies"
  ON public.strategy_cache
  FOR INSERT
  WITH CHECK (portfolio_id IN (
    SELECT id FROM public.portfolios WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own strategies"
  ON public.strategy_cache
  FOR UPDATE
  USING (portfolio_id IN (
    SELECT id FROM public.portfolios WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own strategies"
  ON public.strategy_cache
  FOR DELETE
  USING (portfolio_id IN (
    SELECT id FROM public.portfolios WHERE user_id = auth.uid()
  ));

-- Create index for faster lookups
CREATE INDEX idx_strategy_cache_portfolio_id ON public.strategy_cache(portfolio_id);

-- Add trigger for updated_at
CREATE TRIGGER update_strategy_cache_updated_at
  BEFORE UPDATE ON public.strategy_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();