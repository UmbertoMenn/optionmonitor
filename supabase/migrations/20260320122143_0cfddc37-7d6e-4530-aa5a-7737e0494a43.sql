
CREATE TABLE public.strategy_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  underlying text NOT NULL,
  strategy_type text NOT NULL,
  position_signatures jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_synthetic boolean NOT NULL DEFAULT false,
  linked_stock_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(portfolio_id, underlying, strategy_type)
);

ALTER TABLE public.strategy_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all strategy_configurations"
  ON public.strategy_configurations
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own strategy_configurations"
  ON public.strategy_configurations
  FOR SELECT
  TO public
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own strategy_configurations"
  ON public.strategy_configurations
  FOR INSERT
  TO public
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own strategy_configurations"
  ON public.strategy_configurations
  FOR UPDATE
  TO public
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own strategy_configurations"
  ON public.strategy_configurations
  FOR DELETE
  TO public
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
