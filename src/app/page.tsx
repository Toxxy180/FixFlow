import { getPublicCatalog } from '@/lib/catalog';
import { TechnicianExplorer } from '@/components/technician-explorer';
import { bangkokDate } from '@/lib/constants';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const [catalog, user, settings] = await Promise.all([
    getPublicCatalog(),
    getCurrentUser(),
    getSettings(),
  ]);
  const { technicians: publicTechnicians, services, categories, districts } = catalog;
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
