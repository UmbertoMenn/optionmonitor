ALTER TABLE public.ticker_fundamentals ADD COLUMN IF NOT EXISTS beta_manual boolean NOT NULL DEFAULT false;

GRANT INSERT, UPDATE ON public.ticker_fundamentals TO authenticated;

DROP POLICY IF EXISTS "ticker_fundamentals_admin_write" ON public.ticker_fundamentals;
CREATE POLICY "ticker_fundamentals_admin_write"
ON public.ticker_fundamentals
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));