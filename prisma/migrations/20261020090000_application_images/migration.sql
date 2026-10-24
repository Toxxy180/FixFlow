CREATE TYPE "ApplicationStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "AppUser" ADD COLUMN "avatarPath" TEXT;
ALTER TABLE "Technician"
  ADD COLUMN "portfolioPaths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "portfolioUrl" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "applicationStatus" "ApplicationStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "applicationSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "applicationReviewedAt" TIMESTAMP(3),
  ADD COLUMN "applicationReviewNote" TEXT NOT NULL DEFAULT '';
UPDATE "Technician" t SET "applicationStatus" = 'PENDING', "applicationSubmittedAt" = CURRENT_TIMESTAMP
FROM "AppUser" u WHERE t."userId" = u.id AND u.role = 'CUSTOMER' AND NOT t.active;
UPDATE "Technician" t SET "applicationStatus" = 'APPROVED'
FROM "AppUser" u WHERE t."userId" = u.id AND u.role = 'TECHNICIAN';
CREATE TABLE "UserImage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" UUID NOT NULL REFERENCES "AppUser"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('AVATAR', 'PORTFOLIO')),
  "path" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "UserImage_ownerId_kind_idx" ON "UserImage"("ownerId", "kind");
ALTER TABLE "UserImage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "UserImage" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "UserImage" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "UserImage" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fixflow_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "UserImage" TO fixflow_app;
    CREATE POLICY fixflow_backend_access ON "UserImage" FOR ALL TO fixflow_app USING (true) WITH CHECK (true);
  END IF;
END $$;
