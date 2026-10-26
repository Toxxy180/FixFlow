import { auditLabel } from '@/lib/audit-label';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { roleLabels, statusLabels } from '@/lib/status';
import { accountStatus } from '@/lib/account-status';
import { UserAvatar } from '@/components/user-avatar';
import { UserStatusBadge, roleRing } from '@/components/user-status-badge';
import { ManagedUserForm } from '@/components/managed-user-form';

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('ADMIN', '/admin/users');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [user, audit] = await Promise.all([
    prisma.appUser.findUnique({
      where: { id },
      include: {
        technician: { include: { _count: { select: { bookings: true } } } },
        _count: { select: { bookings: true } },
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, reference: true, status: true },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: { targetId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { actor: { select: { name: true } } },
    }),
  ]);
  if (!user) notFound();
  const status = accountStatus(user);
  const openJobs = await prisma.booking.count({
    where: {
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
      OR: [{ customerId: id }, ...(user.technician ? [{ technicianId: user.technician.id }] : [])],
    },
  });
  const formatDate = (value: Date) =>
    new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Bangkok',
    }).format(value);
  const until = user.suspendedUntil
    ? new Date(user.suspendedUntil.getTime() + 7 * 3600000).toISOString().slice(0, 16)
    : '';
  return (
    <>
      <Link href="/admin/users" className="text-sm text-primary">
        ← กลับไปผู้ใช้งาน
      </Link>
      <h1 className="page-title mt-5">รายละเอียดผู้ใช้</h1>
      <div className="mt-6 grid grid-cols-[1.2fr_1fr] gap-6 max-xl:grid-cols-1">
        <section className="panel">
          <div className="flex items-center gap-4">
            <UserAvatar
              path={user.avatarPath}
              name={user.name}
              className={`h-16 w-16 ${roleRing[user.role]}`}
            />
            <div>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="mt-1 text-sm text-muted">{roleLabels[user.role]}</p>
            </div>
          </div>
          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="text-muted">ชื่อ-นามสกุลในบัญชี</dt>
              <dd className="mt-1 font-semibold">{user.name}</dd>
            </div>
            <div>
              <dt className="text-muted">อีเมล</dt>
              <dd className="mt-1 break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted">เบอร์โทร</dt>
              <dd className="mt-1">{user.phone || 'ยังไม่ระบุ'}</dd>
            </div>
            <div>
              <dt className="text-muted">วันที่สร้างบัญชี</dt>
              <dd className="mt-1">{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="mb-2 text-muted">สถานะ</dt>
              <dd>
                <UserStatusBadge status={status} />
              </dd>
            </div>
            {status !== 'ACTIVE' ? (
              <div>
                <dt className="text-muted">เหตุผล</dt>
                <dd className="mt-1 whitespace-pre-wrap">
                  {user.suspensionReason || 'ไม่ได้ระบุ'}
                  {status === 'SUSPENDED' && user.suspendedUntil ? (
                    <p className="mt-2">ถึง {formatDate(user.suspendedUntil)} (เวลาไทย)</p>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>
          {user.technician ? (
            <div className="mt-6 border-t border-line pt-4 text-sm">
              <p>
                ข้อมูลช่าง: {user.technician.name} · งานทั้งหมด {user.technician._count.bookings}{' '}
                งาน
              </p>
              <Link
                href={`/admin/technicians/${user.technician.id}`}
                className="mt-2 inline-block text-primary"
              >
                ดูใบสมัครและรายละเอียดช่าง →
              </Link>
            </div>
          ) : null}
        </section>
        <section className="panel">
          <h2 className="section-title">จัดการสถานะบัญชี</h2>
          <p className="my-4 text-sm leading-relaxed text-muted">
            เปิดใช้งาน ปิดบัญชี หรือระงับชั่วคราว โดยยังเก็บประวัติและรูปเดิมไว้
          </p>
          {openJobs ? (
            <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              มีงานที่ยังไม่จบ {openJobs} งาน หากปิดหรือระงับบัญชี ผู้ใช้จะจัดการงานไม่ได้ Admin
              ยังจัดการงานเหล่านี้ได้จากรายการจอง
            </p>
          ) : null}
          {user.role === 'ADMIN' ? (
            <p className="rounded-lg bg-soft p-4 text-sm">
              บัญชีผู้ดูแลระบบ: ดูรายละเอียดได้ ไม่สามารถเปลี่ยนบทบาทหรือสถานะจากหน้านี้
            </p>
          ) : (
            <ManagedUserForm
              key={`${user.updatedAt.toISOString()}-${status}`}
              id={id}
              initialStatus={status}
              until={until}
              reason={user.suspensionReason}
            />
          )}
        </section>
      </div>
      <section className="panel mt-6">
        <h2 className="section-title">
          ประวัติการจองล่าสุด · ทั้งหมด {user._count.bookings} รายการ
        </h2>
        <div className="mt-4 divide-y divide-line">
          {user.bookings.length ? (
            user.bookings.map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span className="font-semibold text-primary">{b.reference}</span>
                <span>{statusLabels[b.status]}</span>
              </Link>
            ))
          ) : (
            <p className="py-4 text-sm text-muted">ยังไม่มีประวัติการจอง</p>
          )}
        </div>
        <Link
          href={`/admin/bookings?q=${encodeURIComponent(user.email)}`}
          className="mt-3 inline-block text-sm text-primary"
        >
          ดูรายการจองทั้งหมด →
        </Link>
      </section>
      <section className="panel mt-6">
        <h2 className="section-title">ประวัติการจัดการบัญชี</h2>
        <div className="mt-4 divide-y divide-line">
          {audit.length ? (
            audit.map((a) => (
              <div key={a.id} className="py-3 text-sm">
                <p className="break-words">{auditLabel(a.action)}</p>
                <p className="mt-1 text-xs text-muted">
                  {a.actor.name} · {formatDate(a.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="py-4 text-sm text-muted">ยังไม่มีประวัติการจัดการบัญชี</p>
          )}
        </div>
      </section>
    </>
  );
}
