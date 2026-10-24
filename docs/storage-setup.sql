-- Run once in Supabase SQL Editor, after applying Prisma migrations.
-- Avatars are public; portfolio images are private (owner + active Admin only).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('fixflow-avatars', 'fixflow-avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp']),
  ('fixflow-portfolios', 'fixflow-portfolios', false, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.fixflow_storage_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public."AppUser"
    WHERE id = (SELECT auth.uid()) AND role = 'ADMIN' AND active);
$$;
REVOKE ALL ON FUNCTION public.fixflow_storage_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fixflow_storage_admin() TO authenticated;

DROP POLICY IF EXISTS fixflow_image_insert ON storage.objects;
CREATE POLICY fixflow_image_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('fixflow-avatars','fixflow-portfolios')
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS fixflow_image_select ON storage.objects;
CREATE POLICY fixflow_image_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('fixflow-avatars','fixflow-portfolios') AND (
  (storage.foldername(name))[1] = (SELECT auth.uid())::text
  OR (bucket_id = 'fixflow-portfolios' AND (SELECT public.fixflow_storage_admin()))));

DROP POLICY IF EXISTS fixflow_image_delete ON storage.objects;
CREATE POLICY fixflow_image_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('fixflow-avatars','fixflow-portfolios')
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
-- No UPDATE policy: uploads use unique paths and never overwrite another object.
