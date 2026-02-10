
-- Fix: restrict notification_logs INSERT to service_role only
DROP POLICY "Service role can insert notification logs" ON public.notification_logs;

CREATE POLICY "Service role can insert notification logs"
  ON public.notification_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
