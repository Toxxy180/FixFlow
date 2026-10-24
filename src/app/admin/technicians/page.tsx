import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { currency } from '@/lib/constants';
import { TechnicianEditor } from '@/components/technician-editor';
import { ArchiveButton } from '@/components/archive-button';
import Link from 'next/link';
export default async function AdminTechnicians() {
  await requireRole('ADMIN', '/admin/technicians');
  const [technicians, categories, districts, users] = await Promise.all([
    prisma.technician.findMany({
      include: { areas: true, user: { select: { name: true, email: true, role: true } } },
      orderBy: [{ active: 'asc' }, { name: 'asc' }],
    }),
    prisma.serviceCategory.findMany({ select: { id: true, name: true } }),
    prisma.district.findMany({ orderBy: { name: 'asc' } }),
    prisma.appUser.findMany({
      where: {
        active: true,
        OR: [{ role: 'TECHNICIAN' }, { role: 'CUSTOMER', technician: { isNot: null } }],
      },
      select: { id: true, name: true, email: true },
    }),
  ]);
  const pendingApplications = technicians.filter(
    (technician) => technician.applicationStatus === 'PENDING',
  );
  return (
    <>
      <h1 className="page-title">จัดการช่าง</h1>
      <p className="mt-2 text-sm text-muted">
        โปรไฟล์ บัญชีผู้รับงาน พื้นที่ และวันเวลาที่เปิดบริการ
      </p>
      <p className="mt-3 text-sm text-primary">
        ใบสมัครรออนุมัติ {pendingApplications.length} รายการ
      </p>
      <section className="panel mt-5">
        <h2 className="section-title">คำขอสมัครเป็นช่าง</h2>
        {pendingApplications.length ? (
          <div className="mt-4 space-y-3">
            {pendingApplications.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4"
              >
                <div>
                  <strong>{t.name}</strong>
                  <p className="mt-1 text-xs text-muted">{t.user?.email} · รอตรวจสอบ</p>
                </div>
                <Link href={`/admin/technicians/${t.id}`} className="btn text-sm">
                  ดูรายละเอียดคำขอ
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">ไม่มีคำขอสมัครช่างที่รอตรวจสอบ</p>
        )}
      </section>
      <details className="panel my-6">
        <summary className="cursor-pointer font-semibold text-primary">เพิ่มช่างใหม่</summary>
        <div className="mt-5">
          <TechnicianEditor categories={categories} districts={districts} users={users} />
        </div>
      </details>
      <div className="space-y-4">
        {technicians.map((t) => (
          <details key={`${t.id}-${t.active}`} className="panel">
            <summary className="cursor-pointer">
              <span className="ml-2 inline-flex flex-wrap items-center gap-3">
                <strong>{t.name}</strong>
                <span className="text-sm text-muted">
                  เริ่มต้น ฿{currency(t.price)} · {t.areas.length} เขต
                </span>
                <span
                  className={`rounded-md px-2 py-1 text-xs ${t.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-muted'}`}
                >
                  {t.active
                    ? 'เปิดรับงาน'
                    : t.applicationStatus === 'REJECTED'
                      ? 'ส่งกลับให้แก้ไข'
                      : t.applicationStatus === 'PENDING'
                        ? 'รออนุมัติ'
                        : 'พักรับงาน'}
                </span>
              </span>
            </summary>
            <p className="my-4 text-xs text-muted">บัญชี: {t.user?.email || 'ยังไม่เชื่อมบัญชี'}</p>
            {t.applicationStatus !== 'NONE' ? (
              <div className="mb-5 rounded-lg bg-amber-50 p-4">
                <p className="mb-3 text-sm">
                  {t.applicationStatus === 'APPROVED'
                    ? 'ใบสมัครได้รับอนุมัติแล้ว ดูข้อมูลและรูปประกอบเดิมได้ที่นี่'
                    : 'ตรวจข้อมูลและรูปประกอบใบสมัครก่อนพิจารณาอนุมัติ'}
                </p>
                <Link href={`/admin/technicians/${t.id}`} className="btn text-sm">
                  ดูรายละเอียดและรูปประกอบใบสมัคร
                </Link>
              </div>
            ) : null}
            <TechnicianEditor
              technician={{
                id: t.id,
                name: t.name,
                initials: t.initials,
                category: t.category,
                description: t.description,
                price: t.price,
                color: t.color,
                experience: t.experience,
                active: t.active,
                userId: t.userId,
                workDays: t.workDays,
                availableTimes: t.availableTimes,
                districtIds: t.areas.map((a) => a.districtId),
              }}
              categories={categories}
              districts={districts}
              users={users}
            />
            {t.active ? (
              <div className="mt-5 border-t border-line pt-4">
                <ArchiveButton kind="TECHNICIAN" id={t.id} />
              </div>
            ) : null}
          </details>
        ))}
      </div>
    </>
  );
}
