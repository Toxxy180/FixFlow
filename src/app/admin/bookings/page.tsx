import Link from 'next/link';
import { Prisma, JobStatus } from '@prisma/client';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { statusLabels } from '@/lib/status';
import { BookingTable } from '@/components/booking-table';
export default async function AdminBookings({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireRole('ADMIN', '/admin/bookings');
  const params = await searchParams;
  const status = Object.values(JobStatus).includes(params.status as JobStatus)
    ? (params.status as JobStatus)
    : undefined;
  const q = (params.q || '').slice(0, 100).trim();
  const page = Math.min(1000, Math.max(1, Number.parseInt(params.page || '1') || 1));
  const where: Prisma.BookingWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: 'insensitive' } },
            { customerName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: { technician: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip: (page - 1) * 20,
    }),
    prisma.booking.count({ where }),
  ]);
  return (
    <>
      <h1 className="page-title">รายการจอง</h1>
      <p className="mt-2 text-sm text-muted">ตรวจสอบและจัดการงานทั้งหมด</p>
      <form className="my-6 flex flex-wrap gap-3">
        <input
          name="q"
          aria-label="ค้นหารายการจอง"
          className="input max-w-xs"
          defaultValue={q}
          placeholder="เลขที่งาน หรือชื่อลูกค้า"
          maxLength={100}
        />
        <select
          name="status"
          aria-label="สถานะงาน"
          className="input w-auto"
          defaultValue={status || ''}
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(statusLabels).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button className="btn text-sm">ค้นหา</button>
      </form>
      <section className="panel">
        <p className="mb-4 text-sm text-muted">พบ {total} รายการ</p>
        <BookingTable bookings={bookings} />
        <div className="mt-5 flex justify-between text-sm">
          {page > 1 ? (
            <Link
              className="text-primary"
              href={`/admin/bookings?page=${page - 1}&status=${status || ''}&q=${encodeURIComponent(q)}`}
            >
              ก่อนหน้า
            </Link>
          ) : (
            <span />
          )}
          <span>หน้า {page}</span>
          {page * 20 < total ? (
            <Link
              className="text-primary"
              href={`/admin/bookings?page=${page + 1}&status=${status || ''}&q=${encodeURIComponent(q)}`}
            >
              ถัดไป
            </Link>
          ) : (
            <span />
          )}
        </div>
      </section>
    </>
  );
}
