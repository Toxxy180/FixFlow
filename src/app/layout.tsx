import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/header';
import { getAccount } from '@/lib/auth';
import { accountRestriction, isAccountAllowed } from '@/lib/account-status';
import { AccountStatusNotice } from '@/components/account-status-notice';
import { getSettings } from '@/lib/settings';
import { isDemoMode } from '@/lib/config';
import { icons } from 'lucide-react';
export const metadata: Metadata = {
  title: 'FixFlow | จองช่าง ดูแลบ้าน',
  description: 'จองช่างและติดตามงานในกรุงเทพมหานคร 50 เขต',
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [account, settings] = await Promise.all([getAccount(), getSettings().catch(() => null)]);
  return (
    <html lang="th">
      <body>
        <Header
          restricted={Boolean(account && !isAccountAllowed(account))}
          user={
            account
              ? {
                  id: account.id,
                  name: account.name,
                  email: account.email,
                  role: account.role,
                  phone: account.phone,
                  avatarPath: account.avatarPath,
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
        {account ? <AccountStatusNotice initialMessage={accountRestriction(account)} /> : null}
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
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
