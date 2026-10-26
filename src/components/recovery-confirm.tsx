'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPasswordRecovery } from '@/app/auth/actions';

export function RecoveryConfirm({ tokenHash }: { tokenHash: string }) {
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-7">
      <h1 className="text-2xl font-bold">ยืนยันการตั้งรหัสผ่านใหม่</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        กดปุ่มด้านล่างเพื่อยืนยันลิงก์จากอีเมล แล้วตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ
      </p>
      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const form = new FormData();
          form.set('token_hash', tokenHash);
          start(async () => {
            setError('');
            try {
              const result = await confirmPasswordRecovery(form);
              if (result.error) setError(result.error);
              else if (result.redirectTo) {
                router.replace(result.redirectTo);
                router.refresh();
              }
            } catch {
              setError('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง');
            }
          });
        }}
      >
        <button className="btn w-full" disabled={pending}>
          {pending ? 'กำลังยืนยัน…' : 'ดำเนินการตั้งรหัสผ่านใหม่'}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Link href="/forgot-password" className="mt-5 block text-center text-sm text-primary">
        ขอลิงก์ใหม่
      </Link>
    </div>
  );
}
