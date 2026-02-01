-- Allow admins to manage isin_mappings (insert, update, delete)
CREATE POLICY "Admins can manage isin mappings"
  ON public.isin_mappings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));