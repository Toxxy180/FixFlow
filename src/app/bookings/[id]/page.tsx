import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, Star, Clock3 } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { bookingInclude } from '@/lib/types';
import { currency, dateLabel } from '@/lib/constants';
import { statusClass, statusLabels } from '@/lib/status';
import { JobControls, PartForm, RemovePartButton } from '@/components/job-controls';
import { roleForBooking } from '@/lib/booking-access';
export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/bookings/${id}`);
  const booking = await prisma.booking.findFirst({
    where: {
      id,
      ...(user.role === 'ADMIN'
        ? {}
        : { OR: [{ customerId: user.id }, { technician: { userId: user.id } }] }),
    },
    include: bookingInclude,
  });
  if (!booking) notFound();
  const jobRole = roleForBooking(user, booking);
  if (!jobRole) notFound();
  const back =
    jobRole === 'ADMIN'
      ? '/admin/bookings'
      : jobRole === 'TECHNICIAN'
        ? '/technician'
        : '/bookings';
  const editable =
    (jobRole === 'TECHNICIAN' || jobRole === 'ADMIN') && booking.status === 'IN_PROGRESS';
  return (
    <main className="shell py-9">
      <Link href={back} className="mb-6 inline-flex items-center gap-2 text-sm text-muted">
        <ArrowLeft size={17} />
        กลับไปหน้ารายการ
      </Link>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted">{booking.reference}</p>
          <h1 className="mt-2 page-title">{booking.serviceName}</h1>
        </div>
        <span
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${statusClass(booking.status)}`}
        >
          {statusLabels[booking.status]}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6 max-lg:grid-cols-1">
        <div className="space-y-6">
          <section className="panel">
            <h2 className="section-title">รายละเอียดการนัดหมาย</h2>
            <div className="mt-5 grid grid-cols-2 gap-5 text-sm max-sm:grid-cols-1">
              <p className="flex items-center gap-2">
                <CalendarDays size={18} className="text-muted" />
                {dateLabel(booking.date)} · {booking.time} น.
              </p>
              <p>
                ช่างผู้รับงาน: <strong>{booking.technician.name}</strong>
              </p>
              <p className="flex items-start gap-2">
                <MapPin size={18} className="shrink-0 text-muted" />
                <span className="break-words">
                  {booking.address}
                  <br />
                  เขต{booking.district.name} กรุงเทพมหานคร
                </span>
              </p>
              <p className="break-words">
                ผู้จอง:{' '}
                {user.role === 'ADMIN' ? (
                  <Link
                    className="font-semibold text-primary hover:underline"
                    href={`/admin/users/${booking.customer.id}`}
                  >
                    {booking.customer.name}
                  </Link>
                ) : (
                  booking.customer.name
                )}
                {booking.customerName !== booking.customer.name ? (
                  <span className="mt-1 block text-xs text-muted">
                    ชื่อที่บันทึกตอนจอง: {booking.customerName}
                  </span>
                ) : null}
                <br />
                <span className="text-muted">โทร {booking.phone}</span>
              </p>
            </div>
            {booking.details ? (
              <p className="mt-5 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-sm leading-relaxed">
                {booking.details}
              </p>
            ) : null}
          </section>
          <section className="panel">
            <h2 className="section-title">ค่าใช้จ่าย</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt>ค่าบริการ</dt>
                <dd>฿{currency(booking.price)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>ค่าเดินทาง</dt>
                <dd>฿{currency(booking.travelFee)}</dd>
              </div>
              {booking.parts.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3">
                  <dt className="min-w-0 break-words">
                    {p.name} · {p.quantity} × ฿{currency(p.unitPrice)}
                  </dt>
                  <dd className="flex items-center gap-3">
                    ฿{currency(p.quantity * p.unitPrice)}
                    {editable ? <RemovePartButton id={id} partId={p.id} /> : null}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-4 text-lg font-bold">
                <dt>ยอดรวม</dt>
                <dd className="text-primary">฿{currency(booking.totalAmount)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              {booking.payment?.status === 'PAID' ? 'ชำระเงินจำลองเรียบร้อยแล้ว' : 'ยังไม่ชำระเงิน'}{' '}
              · การชำระเงินสำหรับสาธิต Mini Project
            </p>
            {editable ? (
              <div className="mt-6 border-t border-line pt-5">
                <h3 className="mb-4 text-sm font-semibold">เพิ่มรายการอะไหล่หน้างาน</h3>
                <PartForm id={id} />
              </div>
            ) : null}
          </section>
          {booking.review ? (
            <section className="panel">
              <h2 className="section-title">รีวิวของลูกค้า</h2>
              <p className="mt-4 flex items-center gap-1 text-amber-500">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    size={20}
                    className={i < booking.review!.rating ? 'fill-amber-400' : 'text-slate-200'}
                  />
                ))}
                <span className="ml-2 text-sm text-ink">{booking.review.rating}/5</span>
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">
                {booking.review.comment || 'ไม่มีความคิดเห็นเพิ่มเติม'}
              </p>
            </section>
          ) : null}
        </div>
        <aside className="space-y-6">
          <section className="panel">
            <h2 className="section-title">ประวัติสถานะงาน</h2>
            <ol className="mt-5 space-y-5">
              {booking.history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-soft text-primary">
                    <Clock3 size={15} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{statusLabels[h.status]}</h3>
                    <p className="mt-1 text-xs text-muted">
                      {new Intl.DateTimeFormat('th-TH', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'Asia/Bangkok',
                      }).format(h.createdAt)}
                    </p>
                    {h.note ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted">{h.note}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <JobControls
            id={id}
            role={jobRole}
            status={booking.status}
            reviewed={Boolean(booking.review)}
          />
        </aside>
      </div>
    </main>
  );
}
