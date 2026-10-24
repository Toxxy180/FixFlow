import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/header';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { isDemoMode } from '@/lib/config';
export const metadata: Metadata = {
  title: 'FixFlow | จองช่าง ดูแลบ้าน',
  description: 'จองช่างและติดตามงานในกรุงเทพมหานคร 50 เขต — WebApps Mini Project',
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings().catch(() => null)]);
  return (
    <html lang="th">
      <body>
        <Header
          user={
            user
              ? {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  phone: user.phone,
                  avatarPath: user.avatarPath,
                }
              : null
          }
          siteName={settings?.siteName || 'FixFlow'}
        />
        {isDemoMode() ? (
          <div className="border-b border-blue-100 bg-soft py-2 text-center text-xs text-primary">
            โหมดสาธิตในเครื่อง · ข้อมูลตัวอย่าง · ไม่ส่ง OTP · การชำระเงินจำลอง
          </div>
        ) : null}
        {children}
        <footer className="border-t border-line bg-white">
          <div className="shell flex flex-wrap items-center justify-between gap-4 py-5 text-sm text-muted">
            <span>
              <strong className="font-semibold">{settings?.siteName || 'FixFlow'}</strong> ·
              บ้านพร้อม ช่างพร้อม
            </span>
            <div className="flex flex-wrap gap-4 text-xs">
              {settings?.contactPhone ? (
                <a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a>
              ) : null}
              {settings?.contactEmail ? (
                <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
              ) : null}
              <span>WebApps Mini Project · กรุงเทพมหานคร</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
