
CREATE TABLE IF NOT EXISTS public.ticker_fundamentals (
  ticker TEXT PRIMARY KEY,
  name TEXT,
  currency TEXT,
  beta NUMERIC,
  beta_source TEXT,
  rv NUMERIC,
  risk_free NUMERIC,
  price NUMERIC,
  beta_updated_at TIMESTAMPTZ,
  rv_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ticker_fundamentals TO authenticated;
GRANT ALL ON public.ticker_fundamentals TO service_role;
ALTER TABLE public.ticker_fundamentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticker_fundamentals_read_authenticated" ON public.ticker_fundamentals FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.equity_risk_premiums (
  country TEXT PRIMARY KEY,
  currency TEXT,
  erp_pct NUMERIC NOT NULL,
  source TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.equity_risk_premiums TO authenticated;
GRANT ALL ON public.equity_risk_premiums TO service_role;
ALTER TABLE public.equity_risk_premiums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equity_risk_premiums_read_authenticated" ON public.equity_risk_premiums FOR SELECT TO authenticated USING (true);
