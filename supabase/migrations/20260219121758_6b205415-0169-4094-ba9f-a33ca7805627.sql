
CREATE TABLE public.monitoring_snapshot (
  portfolio_id uuid PRIMARY KEY REFERENCES public.portfolios(id) ON DELETE CASCADE,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monitoring_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own snapshots"
ON public.monitoring_snapshot
FOR SELECT
USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can upsert own snapshots"
ON public.monitoring_snapshot
FOR INSERT
WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own snapshots"
ON public.monitoring_snapshot
FOR UPDATE
USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Admins can read all snapshots"
ON public.monitoring_snapshot
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can read all snapshots"
ON public.monitoring_snapshot
FOR SELECT
USING (auth.role() = 'service_role'::text);
