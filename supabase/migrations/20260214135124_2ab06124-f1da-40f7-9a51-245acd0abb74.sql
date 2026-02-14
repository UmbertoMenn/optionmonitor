
CREATE TABLE public.strategy_alert_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_strategy_alert_toggles_user_key 
  ON strategy_alert_toggles(user_id, strategy_key);

ALTER TABLE strategy_alert_toggles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own toggles"
  ON strategy_alert_toggles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all strategy toggles"
  ON strategy_alert_toggles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_strategy_alert_toggles_updated_at
  BEFORE UPDATE ON public.strategy_alert_toggles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
