import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { isAccountAllowed } from '@/lib/account-status';
import { bangkokDate, currency } from '@/lib/constants';
import { UserAvatar } from '@/components/user-avatar';
import { TechnicianBookingButton } from '@/components/technician-booking-button';
export default async function TechnicianDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.length > 100) notFound();
  const [technician, user, settings] = await Promise.all([
    prisma.technician.findUnique({
      where: { id },
      include: {
        user: { select: { active: true, suspendedUntil: true, avatarPath: true } },
        categoryModel: {
          include: { services: { where: { active: true }, orderBy: { price: 'asc' } } },
        },
        areas: { include: { district: true } },
        reviews: {
          select: { id: true, rating: true, comment: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { reviews: true } },
      },
    }),
    getCurrentUser(),
    getSettings(),
  ]);
  if (!technician) notFound();
  const own = Boolean(user && technician.userId === user.id);
  const available =
    technician.active &&
    technician.categoryModel.active &&
    (!technician.user || isAccountAllowed(technician.user));
  if (!available && !own && user?.role !== 'ADMIN') notFound();
  const rating = await prisma.review.aggregate({
    where: { technicianId: id },
    _avg: { rating: true },
  });
  const details = {
    id,
    name: technician.name,
    initials: technician.initials,
    category: technician.category,
    categoryName: technician.categoryModel.name,
    district: technician.district,
    description: technician.description,
    price: technician.price,
    color: technician.color,
    experience: technician.experience,
    avatarPath: technician.user?.avatarPath,
    districtIds: technician.areas.map((a) => a.districtId),
    rating: rating._avg.rating,
    reviewCount: technician._count.reviews,
  };
  const weekdays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  return (
    <main className="shell py-9">
      <Link href="/" className="text-sm text-primary">
        ← กลับไปค้นหาช่าง
      </Link>
      <section className="panel mt-6">
        <div className="flex flex-wrap items-center gap-5">
          <UserAvatar path={details.avatarPath} name={technician.name} className="h-20 w-20" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">
              {technician.categoryModel.name}
              {own ? ' · โปรไฟล์ช่างของคุณ' : ''}
            </p>
            <h1 className="page-title mt-2 break-words">{technician.name}</h1>
            <p className="mt-2 text-sm text-muted">
              ประสบการณ์ {technician.experience} ปี ·{' '}
              {rating._avg.rating
                ? `★ ${rating._avg.rating.toFixed(1)} (${technician._count.reviews} รีวิว)`
                : 'ยังไม่มีรีวิว'}
            </p>
          </div>
          {own ? (
            <Link href="/technician" className="btn">
              ไปงานของฉัน
            </Link>
          ) : user?.role === 'ADMIN' ? (
            <Link href={`/admin/technicians/${id}`} className="btn-secondary">
              จัดการข้อมูลช่าง
            </Link>
          ) : null}
        </div>
        <p className="mt-6 whitespace-pre-wrap leading-relaxed text-muted">
          {technician.description}
        </p>
      </section>
      <div className="mt-6 grid grid-cols-[1.4fr_1fr] gap-6 max-lg:grid-cols-1">
        <section className="panel">
          <h2 className="section-title">บริการและราคา</h2>
          <div className="mt-4 divide-y divide-line">
            {technician.categoryModel.services.map((s) => (
              <div key={s.id} className="flex justify-between gap-4 py-4 text-sm">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="mt-1 text-muted">{s.description}</p>
                </div>
                <p className="whitespace-nowrap">
                  ฿{currency(Math.max(s.price, technician.price))}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            ค่าเดินทาง ฿{currency(settings.travelFee)} · ค่าอะไหล่เพิ่มเติมแสดงในรายการงาน
          </p>
          <div className="mt-5">
            {!available || !settings.bookingEnabled ? (
              <p className="text-sm text-amber-800">พักรับการจองชั่วคราว</p>
            ) : user?.role === 'CUSTOMER' ? (
              <TechnicianBookingButton
                technician={details}
                services={technician.categoryModel.services}
                districts={technician.areas.map((a) => a.district)}
                today={bangkokDate()}
                user={{
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  phone: user.phone,
                  role: user.role,
                  avatarPath: user.avatarPath,
                }}
                settings={settings}
              />
            ) : !user ? (
              <Link href="/login" className="btn">
                เข้าสู่ระบบเพื่อจองช่าง
              </Link>
            ) : (
              <p className="text-sm text-muted">
                {user.role === 'ADMIN'
                  ? 'ผู้ดูแลระบบดูรายละเอียดและจัดการงานได้ การจองใช้สำหรับบัญชีลูกค้า'
                  : 'บัญชีช่างใช้สำหรับรับและจัดการงาน'}
              </p>
            )}
          </div>
        </section>
        <section className="panel">
          <h2 className="section-title">พื้นที่และเวลารับงาน</h2>
          <p className="mt-4 text-sm font-semibold">กรุงเทพมหานคร</p>
          <p className="mt-2 text-sm leading-loose text-muted">
            {technician.areas.map((a) => a.district.name).join(' · ')}
          </p>
          <p className="mt-5 text-sm font-semibold">วันทำงาน</p>
          <p className="mt-2 text-sm text-muted">
            {technician.workDays.map((d) => weekdays[d]).join(' · ')}
          </p>
          <p className="mt-5 text-sm font-semibold">ช่วงเวลานัดหมาย</p>
          <p className="mt-2 text-sm text-muted">{technician.availableTimes.join(' · ')} น.</p>
          <p className="mt-3 text-xs text-muted">เวลาที่ยังว่างจะแสดงเมื่อเลือกวันจอง</p>
        </section>
      </div>
      <section className="panel mt-6">
        <h2 className="section-title">รีวิวจากงานที่เสร็จแล้ว</h2>
        <div className="mt-4 divide-y divide-line">
          {technician.reviews.length ? (
            technician.reviews.map((r) => (
              <article key={r.id} className="py-4 text-sm">
                <p className="font-semibold text-amber-700">★ {r.rating}/5</p>
                <p className="mt-2 whitespace-pre-wrap break-words">
                  {r.comment || 'ไม่มีข้อความรีวิว'}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {r.createdAt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                </p>
              </article>
            ))
          ) : (
            <p className="py-4 text-sm text-muted">ยังไม่มีรีวิว</p>
          )}
        </div>
        {technician._count.reviews > 20 ? (
          <p className="text-xs text-muted">
            แสดง 20 รีวิวล่าสุด จากทั้งหมด {technician._count.reviews} รีวิว
          </p>
        ) : null}
      </section>
    </main>
  );
}
