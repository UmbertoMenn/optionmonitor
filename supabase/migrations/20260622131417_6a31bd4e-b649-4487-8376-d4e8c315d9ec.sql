
-- 1) Ensure vault is available and a cron_secret exists (randomly generated, never exposed in code)
DO $$
DECLARE
  existing uuid;
BEGIN
  SELECT id INTO existing FROM vault.secrets WHERE name = 'cron_secret';
  IF existing IS NULL THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'cron_secret',
      'Shared secret for authenticating internal/cron edge-function calls'
    );
  END IF;
END $$;

-- 2) Update notify_on_new_alert to pass the cron secret to send-notification
CREATE OR REPLACE FUNCTION public.notify_on_new_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  PERFORM net.http_post(
    url := 'https://uareyloxlpvaxmzygpgo.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'alert_id', NEW.id,
      'user_id', NEW.user_id,
      'ticker', NEW.ticker,
      'message', NEW.message,
      'severity', NEW.severity,
      'alert_type', NEW.alert_type,
      'portfolio_id', NEW.portfolio_id
    )
  );
  RETURN NEW;
END;
$function$;

-- 3) Lock down SECURITY DEFINER functions that should never be callable directly by clients.
--    (has_role is intentionally left executable to authenticated/anon because RLS policies depend on it.)
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_alert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_new_alert() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
