-- Tabella dei riacquisti di call CC/DR-CC ("call da rivendere"):
-- traccia prezzo di riacquisto (per il gain alla rivendita) e prezzo di
-- mercato corrente (per il patrimonio netting intrinseco mancante).
CREATE TABLE public.call_buybacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  underlying TEXT NOT NULL,                 -- ticker del sottostante (dal descrittore, es. 'MU')
  descriptor TEXT NOT NULL,                 -- descrittore grezzo banca, es. 'MUQ6C1100'
  strike NUMERIC NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL,                -- contratti riacquistati ancora "aperti" (non rivenduti)
  buyback_price NUMERIC NOT NULL,           -- premio per azione pagato al riacquisto (divisa del titolo)
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  buyback_date DATE NOT NULL,
  market_price NUMERIC,                     -- premio per azione corrente (aggiornato dal cron opzioni)
  market_price_updated_at TIMESTAMP WITH TIME ZONE,
  resold_quantity INTEGER NOT NULL DEFAULT 0,   -- contratti già rivenduti
  resell_price NUMERIC,                     -- ultimo prezzo di rivendita per azione
  resell_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(portfolio_id, descriptor, buyback_date)
);

ALTER TABLE public.call_buybacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own call buybacks"
ON public.call_buybacks
FOR SELECT
USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own call buybacks"
ON public.call_buybacks
FOR INSERT
WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own call buybacks"
ON public.call_buybacks
FOR UPDATE
USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own call buybacks"
ON public.call_buybacks
FOR DELETE
USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE TRIGGER update_call_buybacks_updated_at
BEFORE UPDATE ON public.call_buybacks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Il cron update-option-prices-cron (service role) deve poter aggiornare i prezzi
CREATE POLICY "Service role can update market prices"
ON public.call_buybacks
FOR ALL
USING (auth.role() = 'service_role');
