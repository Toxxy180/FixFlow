CREATE TABLE public."RegistrationIntent" (
  "id" UUID NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "phone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistrationIntent_signup_role" CHECK ("role" IN ('CUSTOMER', 'TECHNICIAN')),
  CONSTRAINT "RegistrationIntent_mobile" CHECK ("phone" ~ '^0[689][0-9]{8}$')
);
ALTER TABLE public."RegistrationIntent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."RegistrationIntent" FROM PUBLIC;
ALTER TABLE public."Payment" ADD COLUMN "recipientPhone" TEXT, ADD COLUMN "recipientName" TEXT;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public."RegistrationIntent" FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fixflow_app') THEN
    GRANT SELECT, INSERT, UPDATE ON public."RegistrationIntent" TO fixflow_app;
    CREATE POLICY fixflow_backend_access ON public."RegistrationIntent" FOR ALL TO fixflow_app USING (true) WITH CHECK (true);
  END IF;
END $$;
