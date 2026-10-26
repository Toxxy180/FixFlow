'use client';
import type { JobStatus, Role } from '@prisma/client';
import { cancelBooking, changeJobStatus, submitReview, addPart, removePart } from '@/app/actions';
import { nextStatus, transitionLabels } from '@/lib/status';
import { ActionForm } from './action-form';
import { MutationButton } from './mutation-button';
import { PromptPayPayment } from './promptpay-payment';
export function JobControls({
  id,
  status,
  role,
  reviewed,
}: {
  id: string;
  status: JobStatus;
  role: Role;
  reviewed: boolean;
}) {
  const next = nextStatus[status];
  return (
    <div className="space-y-5">
      {(role === 'ADMIN' || role === 'TECHNICIAN') && next ? (
        <MutationButton action={() => changeJobStatus(id, next)} label={transitionLabels[next]!} />
      ) : null}
      {role === 'CUSTOMER' && status === 'AWAITING_PAYMENT' ? <PromptPayPayment id={id} /> : null}
      {(role === 'ADMIN' && !['COMPLETED', 'CANCELLED'].includes(status)) ||
      (role === 'CUSTOMER' && ['PENDING', 'ACCEPTED'].includes(status)) ||
      (role === 'TECHNICIAN' && status === 'PENDING') ? (
        <MutationButton
          action={() => cancelBooking(id)}
          label={role === 'TECHNICIAN' ? 'ปฏิเสธงาน' : 'ยกเลิกการจอง'}
          confirm="ยืนยันยกเลิกงานนี้และคืนช่วงเวลาให้ผู้อื่นจอง?"
          danger
        />
      ) : null}
      {role === 'CUSTOMER' && status === 'COMPLETED' && !reviewed ? (
        <div className="panel">
          <h2 className="mb-4 text-lg font-semibold">รีวิวบริการ</h2>
          <ActionForm action={submitReview} label="ส่งรีวิว">
            <input type="hidden" name="bookingId" value={id} />
            <div>
              <label className="label" htmlFor="rating">
                คะแนนความพึงพอใจ
              </label>
              <select id="rating" name="rating" className="input" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} ดาว
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="comment">
                ความคิดเห็น
              </label>
              <textarea
                id="comment"
                name="comment"
                className="input"
                rows={3}
                maxLength={500}
                placeholder="เล่าประสบการณ์ที่ได้รับ"
              />
            </div>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
export function PartForm({ id }: { id: string }) {
  return (
    <ActionForm action={addPart} resetOnSuccess label="เพิ่มอะไหล่">
      <input name="bookingId" type="hidden" value={id} />
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 max-sm:grid-cols-1">
        <div>
          <label className="label" htmlFor="part-name">
            ชื่ออะไหล่
          </label>
          <input
            id="part-name"
            name="name"
            className="input"
            required
            maxLength={100}
            placeholder="เช่น น้ำยาแอร์"
          />
        </div>
        <div>
          <label className="label" htmlFor="quantity">
            จำนวน
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            className="input"
            required
            min={1}
            max={100}
            defaultValue={1}
          />
        </div>
        <div>
          <label className="label" htmlFor="unitPrice">
            ราคาต่อหน่วย (บาท)
          </label>
          <input
            id="unitPrice"
            name="unitPrice"
            type="number"
            className="input"
            required
            min={0}
            max={100000}
            step={1}
          />
        </div>
      </div>
    </ActionForm>
  );
}
export function RemovePartButton({ id, partId }: { id: string; partId: string }) {
  return <MutationButton action={() => removePart(id, partId)} label="ลบรายการ" danger />;
}
