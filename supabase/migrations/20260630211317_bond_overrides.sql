-- Override manuali per i metadati obbligazionari (cedola/scadenza/frequenza).
--
-- Cedola e scadenza NON sono colonne strutturate: la proiezione del patrimonio le deduce
-- dalla description, ma alcuni bond (BTP Valore step-up, BTP Italia inflation-linked, formati
-- non standard) non espongono una cedola fissa nel testo. Questa tabella consente di inserirli
-- a mano. Keyed by ISIN (stabile a re-import dello snapshot).

CREATE TABLE public.bond_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  isin TEXT NOT NULL,
  coupon_rate_pct NUMERIC,         -- cedola annua in % (null = non modellata)
  maturity_date DATE,              -- scadenza
  frequency INTEGER NOT NULL DEFAULT 1, -- pagamenti/anno
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
