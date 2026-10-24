import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BookingTable } from '@/components/booking-table';
export default async function TechnicianDashboard() {
  const user = await requireRole('TECHNICIAN', '/technician');
  const technician = await prisma.technician.findUnique({ where: { userId: user.id } });
  if (!technician)
    return (
      <main className="shell min-h-[70dvh] py-12">
        <h1 className="page-title">งานของฉัน</h1>
        <p className="mt-5 text-muted">
          บัญชีช่างนี้ยังไม่ได้เชื่อมกับโปรไฟล์ช่าง กรุณาให้ Admin เชื่อมบัญชีในเมนูจัดการช่าง
        </p>
      </main>
    );
  const [bookings, pending, working, completed] = await Promise.all([
    prisma.booking.findMany({
      where: { technicianId: technician.id },
      include: { technician: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.booking.count({ where: { technicianId: technician.id, status: 'PENDING' } }),
    prisma.booking.count({
      where: {
        technicianId: technician.id,
        status: { in: ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'AWAITING_PAYMENT'] },
      },
    }),
    prisma.booking.count({ where: { technicianId: technician.id, status: 'COMPLETED' } }),
  ]);
  return (
    <main className="shell min-h-[70dvh] py-10">
      <h1 className="page-title">งานของฉัน</h1>
      <p className="mt-2 text-sm text-muted">{technician.name} · รับงานและอัปเดตสถานะบริการ</p>
      <div className="my-7 grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        {[
          ['รอตอบรับ', pending],
          ['กำลังดำเนินงาน', working],
          ['เสร็จสิ้น', completed],
        ].map(([label, value]) => (
          <div key={label} className="panel">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-3 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <section className="panel">
        <h2 className="mb-5 section-title">รายการงานล่าสุด</h2>
        <BookingTable bookings={bookings} />
        <p className="mt-3 text-xs text-muted">
          แสดงล่าสุด 50 รายการ · เลือกเลขที่งานเพื่อดูรายละเอียด
        </p>
      </section>
      <Link href="/account" className="mt-5 inline-block text-sm text-primary">
        แก้ไขข้อมูลบัญชี
      </Link>
    </main>
  );
}
