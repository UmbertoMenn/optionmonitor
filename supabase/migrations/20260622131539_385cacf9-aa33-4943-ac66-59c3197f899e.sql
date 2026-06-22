
-- 1) Create a private schema (not exposed via the Data API) and move has_role into it.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

-- 2) Rewrite every existing RLS policy that uses public.has_role(...) so it calls private.has_role(...)
DO $$
DECLARE
  r RECORD;
  new_qual TEXT;
  new_check TEXT;
  roles_txt TEXT;
  sql_stmt TEXT;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ILIKE '%has_role(%' OR with_check ILIKE '%has_role(%')
  LOOP
    new_qual := regexp_replace(coalesce(r.qual, ''), '(^|[^.])has_role\(', '\1private.has_role(', 'g');
    new_check := CASE WHEN r.with_check IS NULL THEN NULL
                      ELSE regexp_replace(r.with_check, '(^|[^.])has_role\(', '\1private.has_role(', 'g') END;
    roles_txt := array_to_string(r.roles, ', ');

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);

    sql_stmt := format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s',
      r.policyname, r.tablename, r.permissive, r.cmd, roles_txt
    );

    IF r.cmd = 'INSERT' THEN
      sql_stmt := sql_stmt || format(' WITH CHECK (%s)', coalesce(new_check, new_qual));
    ELSIF r.cmd IN ('SELECT', 'DELETE') THEN
      sql_stmt := sql_stmt || format(' USING (%s)', new_qual);
    ELSE -- UPDATE or ALL
      sql_stmt := sql_stmt || format(' USING (%s)', new_qual);
      IF new_check IS NOT NULL THEN
        sql_stmt := sql_stmt || format(' WITH CHECK (%s)', new_check);
      END IF;
    END IF;

    EXECUTE sql_stmt;
  END LOOP;
END $$;

-- 3) Revoke EXECUTE on public.has_role from clients so signed-in users can no longer call the public copy.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
