import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardList, CalendarDays, ArrowUpRight } from 'lucide-react';
import { Prisma, JobStatus } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { currency, dateLabel } from '@/lib/constants';
import { statusClass, statusLabels } from '@/lib/status';
export default async function Bookings({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (user.role === 'TECHNICIAN') redirect('/technician');
  if (user.role === 'ADMIN') redirect('/admin/bookings');
  const params = await searchParams;
  const page = Math.min(1000, Math.max(1, Number.parseInt(params.page || '1') || 1));
  const selectedStatus = Object.values(JobStatus).includes(params.status as JobStatus)
    ? (params.status as JobStatus)
    : undefined;
  const where: Prisma.BookingWhereInput = {
    customerId: user.id,
    ...(selectedStatus ? { status: selectedStatus } : {}),
  };
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        technician: { select: { name: true, categoryModel: { select: { name: true } } } },
        district: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
      skip: (page - 1) * 12,
    }),
    prisma.booking.count({ where }),
  ]);
  return (
    <main className="shell min-h-[70dvh] py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">การจองของฉัน</h1>
          <p className="mt-2 text-sm text-muted">ติดตามสถานะงานและประวัติบริการของคุณ</p>
        </div>
        <Link href="/" className="btn text-sm">
          จองบริการใหม่
        </Link>
      </div>
      <form className="my-6 flex flex-wrap items-center gap-3">
        <label htmlFor="status" className="text-sm">
          สถานะงาน
        </label>
        <select
          id="status"
          name="status"
          className="input w-auto"
          defaultValue={selectedStatus || ''}
        >
          <option value="">ทั้งหมด</option>
          {Object.entries(statusLabels).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button className="rounded-lg border border-line px-4 py-3 text-sm">กรองรายการ</button>
        <span className="text-sm text-muted">{total} รายการ</span>
      </form>
      {bookings.length ? (
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          {bookings.map((b) => (
            <article key={b.id} className="panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-muted">{b.reference}</p>
                  <h2 className="mt-3 text-lg font-semibold">{b.serviceName}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {b.technician.name} · {b.district.name}
                  </p>
                </div>
                <span
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${statusClass(b.status)}`}
                >
                  {statusLabels[b.status]}
                </span>
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm">
                <CalendarDays size={17} className="text-muted" />
                {dateLabel(b.date)} · {b.time} น.
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <p className="text-sm text-muted">
                  ยอดรวม{' '}
                  <strong className="ml-2 text-lg text-ink">฿{currency(b.totalAmount)}</strong>
                </p>
                <Link
                  href={`/bookings/${b.id}`}
                  className="flex items-center gap-1 text-sm font-semibold text-primary"
                >
                  ดูรายละเอียด
                  <ArrowUpRight size={17} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-line py-16 text-center">
          <ClipboardList size={42} className="mx-auto text-blue-300" />
          <h2 className="mt-4 text-xl font-semibold">ยังไม่มีรายการในสถานะนี้</h2>
          <p className="mt-2 text-sm text-muted">
            เลือกบริการและนัดวันเวลาที่สะดวก หรือเปลี่ยนตัวกรอง
          </p>
          <Link href="/" className="btn mt-5 text-sm">
            ค้นหาช่าง
          </Link>
        </div>
      )}
      {total > 12 ? (
        <div className="mt-6 flex items-center justify-center gap-5">
          {page > 1 ? (
            <Link
              href={`/bookings?page=${page - 1}&status=${selectedStatus || ''}`}
              className="text-sm text-primary"
            >
              ก่อนหน้า
            </Link>
          ) : null}
          <span className="text-sm">หน้า {page}</span>
          {page * 12 < total ? (
            <Link
              href={`/bookings?page=${page + 1}&status=${selectedStatus || ''}`}
              className="text-sm text-primary"
            >
              ถัดไป
            </Link>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
