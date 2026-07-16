-- Canonicalizzazione strategy_configurations: unifica underlying legacy
-- (es. "Adobe Inc", "CREDO TECHNOLOGY GRP", "MERCEDES-BENZ GROUP") al ticker
-- canonico noto ("ADBE", "CRDO", "MBG"), e deduplica righe esattamente
-- identiche nello stesso portfolio. Idempotente: rieseguire non ha effetti.

CREATE OR REPLACE FUNCTION public._canonicalize_underlying(_u text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n text;
BEGIN
  IF _u IS NULL OR btrim(_u) = '' THEN RETURN _u; END IF;
  -- Normalizza: uppercase, rimuovi AZ., punteggiatura e suffissi societari
  n := upper(_u);
  n := regexp_replace(n, '^AZ\.', '', 'g');
  n := regexp_replace(n, '\([^)]*\)', ' ', 'g');
  n := regexp_replace(n, '[^A-Z0-9\s]', ' ', 'g');
  n := regexp_replace(n, '\y(INC|CORP|CORPORATION|LTD|LIMITED|COMMON|STOCK|THE|ADR|ADS|SPA|AG|SA|NV|PLC|HOLDING|HOLDINGS|GROUP|GMBH|LLC|LP|GRP)\y', ' ', 'g');
  n := regexp_replace(n, '\s+', ' ', 'g');
  n := btrim(n);

  -- Mappa conservativa: solo canonici ben identificati.
  RETURN CASE
    WHEN n IN ('ADBE','ADOBE','ADOBE SYSTEMS') THEN 'ADBE'
    WHEN n IN ('CRDO','CREDO','CREDO TECHNOLOGY') THEN 'CRDO'
    WHEN n IN ('MBG','DAI','DAIMLER','MERCEDES','MERCEDES BENZ') THEN 'MBG'
    ELSE _u
  END;
END;
$$;

-- 1) Aggiorna gli underlying alla forma canonica
UPDATE public.strategy_configurations
   SET underlying = public._canonicalize_underlying(underlying),
       updated_at = now()
 WHERE public._canonicalize_underlying(underlying) <> underlying;

-- 2) Dedup esatto nello stesso portfolio: stessa chiave (portfolio, underlying,
--    strategy_type, is_synthetic, linked_stock_id, slot_ids ordinati,
--    position_signatures normalizzate). Mantieni la più vecchia.
WITH normalized AS (
  SELECT
    id,
    portfolio_id,
    underlying,
    strategy_type,
    is_synthetic,
    linked_stock_id,
    md5(coalesce(
      (SELECT string_agg(x, ',' ORDER BY x)
         FROM jsonb_array_elements_text(linked_stock_slot_ids) AS x),
      ''
    )) AS slot_hash,
    md5(position_signatures::text) AS sig_hash,
    created_at
  FROM public.strategy_configurations
), ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY portfolio_id, underlying, strategy_type, is_synthetic,
                        linked_stock_id, slot_hash, sig_hash
           ORDER BY created_at ASC, id ASC
         ) AS rn
    FROM normalized
)
DELETE FROM public.strategy_configurations sc
 USING ranked r
 WHERE sc.id = r.id
   AND r.rn > 1;

-- 3) Cleanup: la funzione era usa-e-getta, non lasciarla in giro
DROP FUNCTION public._canonicalize_underlying(text);
