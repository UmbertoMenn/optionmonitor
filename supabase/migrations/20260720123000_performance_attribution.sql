-- Dati necessari per attribuire il rendimento per classe di attivo e per
-- separare, sulle opzioni, valore intrinseco e valore temporale.

ALTER TABLE public.cost_basis_trades
  ADD COLUMN IF NOT EXISTS asset_type text,
  ADD COLUMN IF NOT EXISTS underlying_key text,
  ADD COLUMN IF NOT EXISTS option_type text,
  ADD COLUMN IF NOT EXISTS strike numeric,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS gross_eur numeric,
  ADD COLUMN IF NOT EXISTS commission_eur numeric,
  ADD COLUMN IF NOT EXISTS underlying_price numeric,
  ADD COLUMN IF NOT EXISTS intrinsic_per_share numeric,
  ADD COLUMN IF NOT EXISTS time_value_per_share numeric,
  ADD COLUMN IF NOT EXISTS attribution_price_source text;

COMMENT ON COLUMN public.cost_basis_trades.underlying_price IS
  'Prezzo del sottostante alla data del trade; serve a separare intrinseco e tempo.';
COMMENT ON COLUMN public.cost_basis_trades.attribution_price_source IS
  'exact_trade_date, previous_close, snapshot_proxy oppure missing.';

CREATE TABLE IF NOT EXISTS public.underlying_price_history (
  ticker text NOT NULL,
  requested_date date NOT NULL,
  price_date date NOT NULL,
  close_price numeric NOT NULL CHECK (close_price > 0),
  source text NOT NULL DEFAULT 'yahoo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, requested_date)
);

ALTER TABLE public.underlying_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read underlying price history"
  ON public.underlying_price_history;
CREATE POLICY "Authenticated users can read underlying price history"
  ON public.underlying_price_history FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.internal_transfer_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  transfer_key text NOT NULL,
  debit_date date NOT NULL,
  credit_date date NOT NULL,
  amount_eur numeric NOT NULL CHECK (amount_eur > 0),
  from_gp boolean NOT NULL DEFAULT false,
  to_gp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, transfer_key)
);

ALTER TABLE public.internal_transfer_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own internal transfers"
  ON public.internal_transfer_ledger;
CREATE POLICY "Users can manage own internal transfers"
  ON public.internal_transfer_ledger FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = portfolio_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = portfolio_id AND p.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can manage all internal transfers"
  ON public.internal_transfer_ledger;
CREATE POLICY "Admins can manage all internal transfers"
  ON public.internal_transfer_ledger FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_cost_basis_trades_attribution
  ON public.cost_basis_trades (portfolio_id, trade_date, asset_type);
CREATE INDEX IF NOT EXISTS idx_internal_transfer_attribution
  ON public.internal_transfer_ledger (portfolio_id, credit_date);
