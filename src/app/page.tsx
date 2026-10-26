import { activeAccountWhere } from '@/lib/account-status';
import { prisma } from '@/lib/prisma';
import { TechnicianExplorer } from '@/components/technician-explorer';
import { bangkokDate } from '@/lib/constants';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const [technicians, services, categories, districts, user, settings] = await Promise.all([
    prisma.technician.findMany({
      where: {
        active: true,
        categoryModel: { active: true, services: { some: { active: true } } },
        OR: [{ userId: null }, { user: activeAccountWhere() }],
      },
      include: {
        categoryModel: true,
        areas: true,
        user: { select: { avatarPath: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.service.findMany({
      where: { active: true, category: { active: true } },
      select: { id: true, name: true, categoryId: true, price: true },
      orderBy: { price: 'asc' },
    }),
    prisma.serviceCategory.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.district.findMany({ orderBy: { name: 'asc' } }),
    getCurrentUser(),
    getSettings(),
  ]);
  const publicTechnicians = technicians.map((t) => ({
    id: t.id,
    name: t.name,
    initials: t.initials,
    category: t.category,
    categoryName: t.categoryModel.name,
    district: t.district,
    description: t.description,
    price: t.price,
    color: t.color,
    experience: t.experience,
    avatarPath: t.user?.avatarPath,
    districtIds: t.areas.map((a) => a.districtId),
    rating: t.reviews.length
      ? t.reviews.reduce((sum, r) => sum + r.rating, 0) / t.reviews.length
      : null,
    reviewCount: t.reviews.length,
  }));
  return (
    <main className="shell">
      <TechnicianExplorer
        technicians={publicTechnicians}
        services={services}
        categories={categories}
        districts={districts}
        today={bangkokDate()}
        user={
          user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatarPath: user.avatarPath,
              }
            : null
        }
        settings={{
          travelFee: settings.travelFee,
          maxAdvanceDays: settings.maxAdvanceDays,
          bookingEnabled: settings.bookingEnabled,
        }}
      />
    </main>
  );
}
