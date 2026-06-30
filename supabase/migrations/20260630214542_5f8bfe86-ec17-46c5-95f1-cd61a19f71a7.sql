CREATE TABLE public.bond_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  isin TEXT NOT NULL,
  coupon_rate_pct NUMERIC,
  maturity_date DATE,
  frequency INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, isin)
);

ALTER TABLE public.bond_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all bond_overrides"
  ON public.bond_overrides FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own bond overrides"
  ON public.bond_overrides FOR SELECT
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own bond overrides"
  ON public.bond_overrides FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own bond overrides"
  ON public.bond_overrides FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own bond overrides"
  ON public.bond_overrides FOR DELETE
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE INDEX idx_bond_overrides_portfolio ON public.bond_overrides(portfolio_id);