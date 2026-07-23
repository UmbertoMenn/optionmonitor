-- Validazione centralizzata del segreto cron.
--
-- Contesto: la migrazione/commit "Fixed security issues" del 2026-07-22 ha aggiunto
-- alle edge function cron un controllo basato sulla env var CRON_SECRET, che non era
-- mai stata configurata su Supabase. Risultato: 401 su ogni invocazione e prezzi
-- (sottostanti + opzioni) fermi dal 2026-07-22 11:26 UTC, alert e notifiche incluse.
--
-- Il segreto autoritativo e' gia' nel Vault (name = 'cron_secret'): e' il valore usato
-- dai job pg_cron e dal trigger notify_on_new_alert. Questa RPC permette alle edge
-- function di validarlo contro quell'unica fonte di verita', senza mai esporne il valore.

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret text;
BEGIN
  IF p_secret IS NULL OR length(p_secret) = 0 THEN
    RETURN false;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_secret IS NULL OR length(v_secret) = 0 THEN
    RETURN false;
  END IF;

  RETURN v_secret = p_secret;
END;
$function$;

-- Solo il service_role (usato dalle edge function) puo' invocarla: mai anon/authenticated.
REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;
