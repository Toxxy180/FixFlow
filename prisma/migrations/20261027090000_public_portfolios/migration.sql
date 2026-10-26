-- Only saved portfolio images of visible technicians may be read by visitors.
-- The bucket stays private; pending applications and unselected uploads keep owner/Admin access.
CREATE OR REPLACE FUNCTION public.fixflow_public_portfolio(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."UserImage" i
    JOIN public."Technician" t ON t."userId" = i."ownerId"
    JOIN public."AppUser" u ON u.id = t."userId"
    JOIN public."ServiceCategory" c ON c.id = t.category
    WHERE i.path = object_name AND i.kind = 'PORTFOLIO'
      AND split_part(object_name, '/', 1) = u.id::text
      AND i.path = ANY(t."portfolioPaths")
      AND t.active AND t."applicationStatus" IN ('APPROVED', 'NONE')
      AND c.active AND u.role = 'TECHNICIAN' AND u.active
      AND (u."suspendedUntil" IS NULL OR u."suspendedUntil" <= now())
  );
$$;
REVOKE ALL ON FUNCTION public.fixflow_public_portfolio(text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.fixflow_public_portfolio(text) TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.fixflow_public_portfolio(text) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fixflow_app') THEN
    GRANT EXECUTE ON FUNCTION public.fixflow_public_portfolio(text) TO fixflow_app;
  END IF;
  IF pg_catalog.to_regclass('storage.objects') IS NOT NULL THEN
    CREATE POLICY fixflow_public_portfolio_select ON storage.objects FOR SELECT TO anon, authenticated
      USING (bucket_id = 'fixflow-portfolios' AND public.fixflow_public_portfolio(name));
  END IF;
END $$;
