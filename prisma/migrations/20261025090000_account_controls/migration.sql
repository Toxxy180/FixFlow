ALTER TABLE public."AppUser" ADD COLUMN "suspendedUntil" TIMESTAMP(3),
  ADD COLUMN "suspensionReason" TEXT NOT NULL DEFAULT '';

-- Return signup status only, never Auth records, IDs, password hashes or tokens.
CREATE OR REPLACE FUNCTION public.fixflow_email_status(candidate text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result text;
BEGIN
  IF EXISTS (SELECT 1 FROM public."AppUser" WHERE lower(email) = lower(trim(candidate))) THEN
    RETURN 'CONFIRMED';
  END IF;
  -- Auth exists on Supabase; local demo databases contain AppUser only.
  IF pg_catalog.to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE 'SELECT CASE WHEN email_confirmed_at IS NULL THEN ''UNCONFIRMED'' ELSE ''CONFIRMED'' END FROM auth.users WHERE lower(email) = lower(trim($1)) AND deleted_at IS NULL LIMIT 1'
      INTO result USING candidate;
  END IF;
  RETURN coalesce(result, 'AVAILABLE');
END;
$$;
REVOKE ALL ON FUNCTION public.fixflow_email_status(text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.fixflow_email_status(text) FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fixflow_app') THEN
    GRANT EXECUTE ON FUNCTION public.fixflow_email_status(text) TO fixflow_app;
  END IF;
END $$;

-- Apply account restrictions to direct private Storage access as well.
DO $migration$ BEGIN
  IF pg_catalog.to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.fixflow_storage_active()
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $body$
        SELECT EXISTS (SELECT 1 FROM public."AppUser" WHERE id = (SELECT auth.uid())
          AND active AND ("suspendedUntil" IS NULL OR "suspendedUntil" <= now()));
      $body$;
    $fn$;
    REVOKE ALL ON FUNCTION public.fixflow_storage_active() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.fixflow_storage_active() TO authenticated;
    DROP POLICY IF EXISTS fixflow_account_access ON storage.objects;
    CREATE POLICY fixflow_account_access ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
      USING (bucket_id NOT IN ('fixflow-avatars', 'fixflow-portfolios') OR (SELECT public.fixflow_storage_active()))
      WITH CHECK (bucket_id NOT IN ('fixflow-avatars', 'fixflow-portfolios') OR (SELECT public.fixflow_storage_active()));
  END IF;
END $migration$;
