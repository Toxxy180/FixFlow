import Link from 'next/link';
import { Prisma, Role } from '@prisma/client';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { roleLabels } from '@/lib/status';
import { accountStatus, activeAccountWhere } from '@/lib/account-status';
import { UserAvatar } from '@/components/user-avatar';
import { UserStatusBadge, roleRing } from '@/components/user-status-badge';

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
}) {
  await requireRole('ADMIN', '/admin/users');
  const params = await searchParams;
  const q = (params.q || '').trim().slice(0, 100);
  const role = Object.values(Role).includes(params.role as Role)
    ? (params.role as Role)
    : undefined;
  const status = ['ACTIVE', 'DISABLED', 'SUSPENDED'].includes(params.status || '')
    ? params.status
    : '';
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.page || '1') || 1));
  const now = new Date();
  const where: Prisma.AppUserWhereInput = {
    AND: [
      role ? { role } : {},
      status === 'ACTIVE'
        ? activeAccountWhere(now)
        : status === 'DISABLED'
          ? { active: false }
          : status === 'SUSPENDED'
            ? { active: true, suspendedUntil: { gt: now } }
            : {},
      q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
            ],
          }
        : {},
    ],
  };
  const [users, total] = await Promise.all([
    prisma.appUser.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    prisma.appUser.count({ where }),
  ]);
  const pageLink = (n: number) =>
    '/admin/users?' +
    new URLSearchParams({ q, role: role || '', status: status || '', page: String(n) });
  return (
    <>
      <h1 className="page-title">ผู้ใช้งาน</h1>
      <p className="mt-2 text-sm text-muted">
        ดูข้อมูลและจัดการสถานะบัญชี · บทบาทเปลี่ยนจากหน้านี้ไม่ได้
      </p>
      <form className="my-6 flex flex-wrap gap-3">
        <input
          className="input min-w-56 flex-1"
          name="q"
          aria-label="ค้นหาผู้ใช้งาน"
          placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร"
          defaultValue={q}
          maxLength={100}
        />
        <select
          name="role"
          aria-label="กรองบทบาท"
          className="input w-auto"
          defaultValue={role || ''}
        >
          <option value="">ทุกบทบาท</option>
          {Object.entries(roleLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="status"
          aria-label="กรองสถานะบัญชี"
          className="input w-auto"
          defaultValue={status}
        >
          <option value="">ทุกสถานะ</option>
          <option value="ACTIVE">เปิดใช้งาน</option>
          <option value="SUSPENDED">ระงับชั่วคราว</option>
          <option value="DISABLED">ปิดบัญชี</option>
        </select>
        <button className="btn">ค้นหา</button>
        <Link className="btn-secondary" href="/admin/users">
          ล้างตัวกรอง
        </Link>
      </form>
      <section className="panel">
        <div className="mb-5 flex flex-wrap justify-between gap-3 text-sm">
          <p>พบ {total} คน</p>
          <p className="text-muted">
            <span className="text-blue-700">● ลูกค้า</span> ·{' '}
            <span className="text-amber-700">● ช่าง</span> ·{' '}
            <span className="text-purple-700">● Admin</span>
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-muted">
              <tr>
                {['ผู้ใช้', 'บทบาท', 'เบอร์โทร', 'สถานะ', 'วันที่สมัคร', 'จัดการ'].map((h) => (
                  <th className="px-4 py-4 font-medium" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line hover:bg-slate-50/60">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        path={u.avatarPath}
                        name={u.name}
                        className={`h-10 w-10 ${roleRing[u.role]}`}
                      />
                      <div>
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="font-semibold hover:text-primary hover:underline"
                        >
                          {u.name}
                        </Link>
                        <p className="mt-1 text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">{roleLabels[u.role]}</td>
                  <td className="px-4 py-4">{u.phone || '—'}</td>
                  <td className="px-4 py-4">
                    <UserStatusBadge status={accountStatus(u, now)} />
                  </td>
                  <td className="px-4 py-4 text-xs text-muted">
                    {u.createdAt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      className="font-semibold text-primary hover:underline"
                      href={`/admin/users/${u.id}`}
                    >
                      ดูรายละเอียด
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length ? (
            <p className="px-4 py-12 text-center text-muted">ไม่พบผู้ใช้ที่ตรงกับการค้นหา</p>
          ) : null}
        </div>
        <div className="mt-5 flex justify-between text-sm">
          {page > 1 ? (
            <Link href={pageLink(page - 1)} className="text-primary">
              ก่อนหน้า
            </Link>
          ) : (
            <span />
          )}
          <span>หน้า {page} · หน้าละ 20 คน</span>
          {page * 20 < total ? (
            <Link href={pageLink(page + 1)} className="text-primary">
              ถัดไป
            </Link>
          ) : (
            <span />
          )}
        </div>
      </section>
      <p className="mt-4 text-xs text-muted">
        ผู้สมัครช่างต้องผ่านการตรวจใบสมัครในหน้าจัดการช่าง บัญชี Admin ดูข้อมูลได้
        แต่แก้บทบาทหรือระงับจากหน้านี้ไม่ได้
      </p>
    </>
  );
}
