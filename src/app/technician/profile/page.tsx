import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TechnicianProfileForm } from '@/components/technician-profile-form';

export default async function TechnicianProfile() {
  const user = await requireRole('TECHNICIAN', '/technician/profile');
  const technician = await prisma.technician.findUnique({
    where: { userId: user.id },
    include: { areas: true },
  });
  if (!technician || !['APPROVED', 'NONE'].includes(technician.applicationStatus))
    redirect('/technician/apply');
  const [categories, districts] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { OR: [{ active: true }, { id: technician.category }] },
      select: { id: true, name: true, active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.district.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return (
    <main className="shell max-w-3xl py-10">
      <Link href="/technician" className="text-sm text-primary">
        ← กลับไปงานของฉัน
      </Link>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">แก้ไขข้อมูลรับงาน</h1>
        <Link href={`/technicians/${technician.id}`} className="btn-secondary text-sm">
          ดูหน้ารายละเอียดของฉัน
        </Link>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        ข้อมูลนี้แสดงให้ลูกค้าเห็นบนหน้าค้นหาช่างและหน้ารายละเอียด การเปลี่ยนราคา พื้นที่ หรือเวลา
        มีผลกับการจองใหม่ ส่วนงานที่จองไว้แล้วใช้ข้อมูลเดิม
      </p>
      {!technician.active ? (
        <p role="status" className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          โปรไฟล์นี้พักรับงานอยู่ คุณแก้ไขข้อมูลได้ และติดต่อ Admin เมื่อต้องการเปิดรับงานอีกครั้ง
        </p>
      ) : null}
      <section className="panel mt-6">
        <TechnicianProfileForm
          technician={{
            name: technician.name,
            category: technician.category,
            description: technician.description,
            price: technician.price,
            experience: technician.experience,
            portfolioUrl: technician.portfolioUrl,
            workDays: technician.workDays,
            availableTimes: technician.availableTimes,
            districtIds: technician.areas.map((area) => area.districtId),
          }}
          categories={categories}
          districts={districts}
        />
      </section>
      <p className="mt-5 text-sm leading-relaxed text-muted">
        รูปโปรไฟล์ ชื่อ-นามสกุล และเบอร์โทร แก้ได้ที่{' '}
        <Link href="/account" className="font-semibold text-primary">
          บัญชีของฉัน
        </Link>{' '}
        · รูปประกอบใบสมัครที่อนุมัติแล้วให้ติดต่อ Admin เพื่อแก้ไข
      </p>
    </main>
  );
}
