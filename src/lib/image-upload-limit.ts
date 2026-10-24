import { prisma } from './prisma';

export async function imageUploadAllowed(userId: string) {
  const key = `image:${userId}`;
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES (${key},1,NOW()+INTERVAL '1 hour')
    ON CONFLICT ("key") DO UPDATE SET
    "count"=CASE WHEN "RateLimit"."expiresAt"<=NOW() THEN 1 ELSE "RateLimit"."count"+1 END,
    "expiresAt"=CASE WHEN "RateLimit"."expiresAt"<=NOW() THEN NOW()+INTERVAL '1 hour' ELSE "RateLimit"."expiresAt" END
    RETURNING "count"`;
  return rows[0].count <= 30;
}
