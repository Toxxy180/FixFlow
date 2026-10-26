'use client';
import { useState } from 'react';
import { ActionForm } from './action-form';
import { saveUser } from '@/app/admin/actions';
import { accountStatusLabels } from '@/lib/account-status';

export function ManagedUserForm({
  id,
  initialStatus,
  until,
  reason,
}: {
  id: string;
  initialStatus: keyof typeof accountStatusLabels;
  until: string;
  reason: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  return (
    <ActionForm action={saveUser} label="บันทึกสถานะบัญชี">
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="account-status" className="label">
          สถานะบัญชี
        </label>
        <select
          className="input"
          id="account-status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          {Object.entries(accountStatusLabels).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {status === 'SUSPENDED' ? (
        <div>
          <label htmlFor="until" className="label">
            ระงับถึงวันที่และเวลา (เวลาไทย)
          </label>
          <input
            id="until"
            className="input"
            type="datetime-local"
            name="until"
            defaultValue={until}
            required
          />
        </div>
      ) : null}
      {status !== 'ACTIVE' ? (
        <div>
          <label htmlFor="reason" className="label">
            เหตุผลที่แจ้งให้ผู้ใช้ทราบ
          </label>
          <textarea
            id="reason"
            name="reason"
            className="input min-h-28"
            defaultValue={reason}
            minLength={3}
            maxLength={500}
            required
          />
          <p className="mt-2 text-xs text-muted">
            ผู้ใช้จะเห็นข้อความนี้เมื่อเข้าสู่ระบบ หรือขณะใช้งานอยู่
          </p>
        </div>
      ) : null}
    </ActionForm>
  );
}
