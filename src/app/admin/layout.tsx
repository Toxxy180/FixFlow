import { requireRole } from '@/lib/auth';
import { AdminNav } from '@/components/admin-nav';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('ADMIN', '/admin');
  return (
    <div className="flex min-h-[calc(100dvh-142px)] bg-[#f7f9fc] max-lg:flex-col">
      <AdminNav />
      <main className="min-w-0 flex-1 p-8 max-sm:p-5">{children}</main>
    </div>
  );
}
