ALTER TABLE "Technician" ALTER COLUMN "workDays" SET DEFAULT ARRAY[0,1,2,3,4,5,6]::INTEGER[];
UPDATE "Technician" SET "workDays" = ARRAY[0,1,2,3,4,5,6]::INTEGER[] WHERE "workDays" = ARRAY[1,2,3,4,5,6,7]::INTEGER[];
ALTER TABLE "Service" ADD CONSTRAINT "Service_price_nonnegative" CHECK ("price" >= 0);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_amounts_nonnegative" CHECK ("price" >= 0 AND "travelFee" >= 0 AND "totalAmount" >= 0);
ALTER TABLE "JobPartItem" ADD CONSTRAINT "Part_values_valid" CHECK ("quantity" > 0 AND "unitPrice" >= 0);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_valid" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_valid" CHECK ("amount" >= 0);

-- The browser uses Supabase Auth only. App data is accessed through authorized
-- Next.js handlers and Prisma. Deny direct access with anon/authenticated keys.
DO $$
DECLARE table_name TEXT; role_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['AppUser','District','ServiceCategory','Service','Technician','TechnicianDistrict','Booking','Slot','JobStatusHistory','JobPartItem','Payment','Review','AppSetting','RateLimit','AuditLog'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;
