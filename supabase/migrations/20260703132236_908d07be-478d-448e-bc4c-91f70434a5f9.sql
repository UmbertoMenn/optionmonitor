ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS restricted_cash_value numeric DEFAULT 0;