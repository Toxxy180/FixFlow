'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '@/lib/types';
export function MutationButton({
  action,
  label,
  confirm,
  danger = false,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  confirm?: string;
  danger?: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  function execute() {
    setError('');
    start(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else {
          setConfirming(false);
          router.refresh();
        }
      } catch {
        setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่');
      }
    });
  }
  return (
    <div>
      {confirming ? (
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="max-w-md text-sm leading-relaxed">{confirm}</p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={execute}
              disabled={pending}
              className={`btn text-sm ${danger ? 'bg-red-600 hover:bg-red-700' : ''}`}
            >
              {pending ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="text-sm text-muted"
            >
              กลับ
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => (confirm ? setConfirming(true) : execute())}
          disabled={pending}
          className={
            danger
              ? 'rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50'
              : 'btn text-sm'
          }
        >
          {pending ? 'กำลังบันทึก...' : label}
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
