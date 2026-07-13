-- Call da rivendere (call_buybacks): due nuovi controlli editoriali.
--
-- included_in_netting: se true, il valore di mercato del riacquisto entra nel
--   totale sommato al Netting Intrinseco A/B (quando il toggle globale è attivo)
--   e nel totale della card "Covered Call da rivendere". La checkbox per riga
--   nella card scrive qui. Default true = comportamento precedente (tutte incluse).
--
-- manually_edited: se true, la riga è stata corretta a mano dal titolare
--   (strike/scadenza/quantità/prezzo di riacquisto). Il CSV ingest NON la
--   sovrascrive più, esattamente come per i deposits con source='manual'.
--   Il cron opzioni continua ad aggiornare SOLO market_price (chiave OCC
--   underlying+strike+expiry), quindi correggere strike/scadenza fa ri-pricizzare
--   automaticamente la call giusta.

ALTER TABLE public.call_buybacks
  ADD COLUMN IF NOT EXISTS included_in_netting BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.call_buybacks
  ADD COLUMN IF NOT EXISTS manually_edited BOOLEAN NOT NULL DEFAULT false;
