-- Run in Supabase SQL Editor AFTER npm run db:setup.
-- Replace the password locally. Never commit the customized file.
CREATE ROLE fixflow_app LOGIN PASSWORD 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
GRANT USAGE ON SCHEMA public TO fixflow_app;
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['AppUser','District','ServiceCategory','Service','Technician','TechnicianDistrict','Booking','Slot','JobStatusHistory','JobPartItem','Payment','Review','AppSetting','RateLimit','AuditLog','UserImage'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO fixflow_app', table_name);
    EXECUTE format('CREATE POLICY fixflow_backend_access ON public.%I FOR ALL TO fixflow_app USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END $$;
GRANT DELETE ON TABLE public."Slot", public."JobPartItem", public."TechnicianDistrict", public."RateLimit", public."UserImage" TO fixflow_app;
-- Use fixflow_app.PROJECT_REF in the transaction pooler DATABASE_URL.
-- DIRECT_URL remains the database-owner session pooler for migrations.
-- Authentication and row ownership are checked in every Next.js server action.
