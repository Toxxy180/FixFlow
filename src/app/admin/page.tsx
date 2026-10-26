import Link from 'next/link';
import {
  CalendarDays,
  Clock3,
  UsersRound,
  UserRound,
  ChevronRight,
  BriefcaseBusiness,
  Settings2,
  ArrowRight,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { BookingTable } from '@/components/booking-table';
export default async function AdminDashboard() {
  await requireRole('ADMIN', '/admin');
  const [total, pending, technicians, users, bookings] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { status: 'PENDING' } }),
    prisma.technician.count(),
    prisma.appUser.count(),
    prisma.booking.findMany({
      include: {
        technician: { select: { name: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);
  const metrics = [
    {
      label: 'รายการจองทั้งหมด',
      value: total,
      icon: CalendarDays,
      color: 'bg-blue-50 text-primary',
    },
    { label: 'รอตอบรับ', value: pending, icon: Clock3, color: 'bg-orange-50 text-orange-500' },
    {
      label: 'ช่างในระบบ',
      value: technicians,
      icon: UsersRound,
      color: 'bg-emerald-50 text-emerald-500',
    },
    { label: 'ผู้ใช้งาน', value: users, icon: UserRound, color: 'bg-violet-50 text-violet-600' },
  ];
  return (
    <>
      <h1 className="page-title">ภาพรวมระบบ</h1>
      <p className="mt-2 text-sm text-muted">จัดการงานและบริการของ FixFlow</p>
      <div className="my-7 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <section key={label} className="panel flex items-center gap-4">
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${color}`}
            >
              <Icon size={27} />
            </span>
            <div>
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-2 text-3xl font-bold">{value}</p>
            </div>
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title">รายการจองล่าสุด</h2>
          <Link href="/admin/bookings" className="flex items-center gap-1 text-sm text-primary">
            ดูทั้งหมด <ArrowRight size={16} />
          </Link>
        </div>
        <BookingTable bookings={bookings} admin />
      </section>
      <h2 className="mb-4 mt-8 section-title">เริ่มจัดการระบบ</h2>
      <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
        {[
          {
            href: '/admin/technicians',
            label: 'จัดการช่าง',
            description: 'เพิ่ม แก้ไข และกำหนดพื้นที่รับงาน',
            icon: UserRound,
          },
          {
            href: '/admin/services',
            label: 'จัดการบริการ',
            description: 'จัดการประเภทบริการและราคา',
            icon: BriefcaseBusiness,
          },
          {
            href: '/admin/settings',
            label: 'ตั้งค่าการจอง',
            description: 'กำหนดเงื่อนไขและตรวจประวัติการจัดการ',
            icon: Settings2,
          },
        ].map(({ href, label, description, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className="panel flex items-center gap-4 transition-colors hover:border-blue-300"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-soft text-primary">
              <Icon size={23} />
            </span>
            <div>
              <h3 className="text-sm font-semibold">{label}</h3>
              <p className="mt-1 text-xs text-muted">{description}</p>
            </div>
            <ChevronRight className="ml-auto shrink-0 text-muted" size={18} />
          </Link>
        ))}
      </div>
    </>
  );
}
