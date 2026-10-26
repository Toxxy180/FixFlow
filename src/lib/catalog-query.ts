import type { PrismaClient } from '@prisma/client';
import type { PublicService, PublicTechnician } from './types';

export type PublicCatalog = {
  technicians: PublicTechnician[];
  services: PublicService[];
  categories: { id: string; name: string }[];
  districts: { id: string; name: string }[];
};

// One database round trip. Aggregate ratings in SQL instead of sending every review to Node.
// Only public fields belong here: this result is shared between anonymous and signed-in visitors.
export async function loadPublicCatalog(db: PrismaClient): Promise<PublicCatalog> {
  const rows = await db.$queryRaw<{ catalog: PublicCatalog }[]>`
    SELECT jsonb_build_object(
      'technicians', COALESCE((
        SELECT jsonb_agg(item ORDER BY item->>'name') FROM (
          SELECT jsonb_build_object(
            'id', t.id, 'name', t.name, 'initials', t.initials,
            'category', t.category, 'categoryName', c.name, 'district', t.district,
            'description', t.description, 'price', t.price, 'color', t.color,
            'experience', t.experience, 'avatarPath', u."avatarPath",
            'districtIds', COALESCE((SELECT jsonb_agg(a."districtId") FROM "TechnicianDistrict" a WHERE a."technicianId" = t.id), '[]'::jsonb),
            'rating', r.rating, 'reviewCount', r.count
          ) AS item
          FROM "Technician" t
          JOIN "ServiceCategory" c ON c.id = t.category
          LEFT JOIN "AppUser" u ON u.id = t."userId"
          LEFT JOIN LATERAL (SELECT avg(rating) AS rating, count(*)::int AS count FROM "Review" WHERE "technicianId" = t.id) r ON true
          WHERE t.active AND c.active
            AND t."applicationStatus" IN ('NONE', 'APPROVED')
            AND (t."userId" IS NULL OR (u.role = 'TECHNICIAN' AND u.active AND (u."suspendedUntil" IS NULL OR u."suspendedUntil" <= now())))
            AND EXISTS (SELECT 1 FROM "Service" s WHERE s."categoryId" = c.id AND s.active)
        ) available
      ), '[]'::jsonb),
      'services', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'categoryId', s."categoryId", 'price', s.price) ORDER BY s.price)
        FROM "Service" s JOIN "ServiceCategory" c ON c.id = s."categoryId" WHERE s.active AND c.active), '[]'::jsonb),
      'categories', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name) FROM "ServiceCategory" WHERE active), '[]'::jsonb),
      'districts', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name) FROM "District"), '[]'::jsonb)
    ) AS catalog`;
  if (!rows[0]?.catalog) throw new Error('Catalog unavailable');
  return rows[0].catalog;
}
