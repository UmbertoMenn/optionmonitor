-- Congela i prezzi dei sottostanti usati per il calcolo del netting, per ogni snapshot.
-- Legati a (portfolio_id, snapshot_date): ogni snapshot ha i suoi prezzi fissi,
-- così la card di netting e i valori storici non si muovono coi prezzi live.
-- Forma: { "UNDERLYING_KEY": prezzo_numerico, ... }
ALTER TABLE public.historical_data
  ADD COLUMN IF NOT EXISTS snapshot_underlying_prices JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.historical_data.snapshot_underlying_prices IS
  'Prezzi dei sottostanti congelati al momento dello snapshot, usati per il netting (intrinseco CC/NP). Chiave = underlying key, valore = prezzo.';
