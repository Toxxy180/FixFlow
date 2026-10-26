import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { currency, dateLabel } from '@/lib/constants';
import { statusClass, statusLabels } from '@/lib/status';
import type { JobStatus } from '@prisma/client';
export type BookingRow = {
  id: string;
  reference: string;
  customerName: string;
  customer: { id: string; name: string };
  technician: { name: string };
  date: string;
  time: string;
  status: JobStatus;
  totalAmount: number;
};
export function BookingTable({
  bookings,
  admin = false,
}: {
  bookings: BookingRow[];
  admin?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className={`overflow-x-auto ${!bookings.length ? 'max-sm:hidden' : ''}`}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-muted">
            <tr>
              {['เลขที่งาน', 'ลูกค้า', 'ช่าง', 'วันนัดหมาย', 'สถานะ', 'ยอดรวม'].map((h) => (
                <th key={h} className="px-4 py-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="px-4 py-4">
                  <Link
                    href={`/bookings/${b.id}`}
                    className="font-mono text-xs font-semibold text-primary hover:underline"
                  >
                    {b.reference}
                  </Link>
                </td>
                <td className="max-w-40 truncate px-4 py-4">
                  {admin ? (
                    <Link
                      href={`/admin/users/${b.customer.id}`}
                      className="text-primary hover:underline"
                    >
                      {b.customer.name}
                    </Link>
                  ) : (
                    b.customer.name
                  )}
                </td>
                <td className="px-4 py-4">{b.technician.name}</td>
                <td className="whitespace-nowrap px-4 py-4">
                  <p>{dateLabel(b.date)}</p>
                  <p className="mt-1 text-xs text-muted">{b.time} น.</p>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold ${statusClass(b.status)}`}
                  >
                    {statusLabels[b.status]}
                  </span>
                </td>
                <td className="px-4 py-4 font-semibold">฿{currency(b.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!bookings.length && (
        <div className="px-4 py-16 text-center">
          <CalendarDays size={36} className="mx-auto text-slate-400" />
          <p className="mt-4 font-semibold text-ink">ยังไม่มีรายการจอง</p>
          <p className="mt-2 text-sm text-muted">รายการใหม่จะแสดงที่นี่เมื่อลูกค้าจองบริการ</p>
        </div>
      )}
    </div>
  );
}
