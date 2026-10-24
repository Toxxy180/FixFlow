'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  CalendarDays,
  UserRound,
  BriefcaseBusiness,
  UsersRound,
  Settings2,
} from 'lucide-react';
const items = [
  { path: '/admin', label: 'ภาพรวม', icon: House },
  { path: '/admin/bookings', label: 'รายการจอง', icon: CalendarDays },
  { path: '/admin/technicians', label: 'ช่าง', icon: UserRound },
  { path: '/admin/services', label: 'บริการ', icon: BriefcaseBusiness },
  { path: '/admin/users', label: 'ผู้ใช้งาน', icon: UsersRound },
  { path: '/admin/settings', label: 'ตั้งค่า', icon: Settings2 },
];
export function AdminNav() {
  const pathname = usePathname();
  return (
    <aside className="w-[260px] shrink-0 border-r border-line bg-white px-4 py-8 max-lg:w-full max-lg:border-r-0 max-lg:border-b max-lg:py-4">
      <h2 className="mb-5 px-3 text-xl font-bold max-lg:hidden">จัดการระบบ</h2>
      <nav
        aria-label="จัดการระบบ"
        className="flex flex-col gap-2 max-lg:flex-row max-lg:overflow-x-auto"
      >
        {items.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            href={path}
            className={`flex items-center gap-4 rounded-lg px-4 py-3 text-sm max-lg:shrink-0 ${pathname === path ? 'bg-blue-50 font-semibold text-primary' : 'text-ink hover:bg-slate-50'}`}
          >
            <Icon size={21} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
