-- Tabella per archiviare i prezzi EOD dei benchmark
CREATE TABLE public.benchmark_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  price_date DATE NOT NULL,
  close_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT benchmark_prices_ticker_date_unique UNIQUE (ticker, price_date)
);

-- Indice per query frequenti su ticker + date range
CREATE INDEX idx_benchmark_prices_ticker_date ON public.benchmark_prices (ticker, price_date DESC);

-- RLS: tabella pubblica in sola lettura (dati di mercato condivisi)
ALTER TABLE public.benchmark_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Benchmark prices are publicly readable"
ON public.benchmark_prices
FOR SELECT
USING (true);

-- Solo le edge functions (service role) possono inserire/aggiornare
CREATE POLICY "Service role can manage benchmark prices"
ON public.benchmark_prices
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Commento sulla tabella per documentazione
COMMENT ON TABLE public.benchmark_prices IS 'Storico prezzi EOD per benchmark (URTH, SPY, ACWI, EXSA.DE, AGG). Aggiornato quotidianamente via cron job.';