'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import type { ActionResult } from '@/lib/types';
export function ActionForm({
  action,
  children,
  label = 'บันทึกข้อมูล',
  className = '',
  onSuccess,
  resetOnSuccess = false,
}: {
  action: (data: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  label?: string;
  className?: string;
  onSuccess?: () => void;
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const router = useRouter();
  return (
    <form
      ref={formRef}
      method="post"
      className={`space-y-4 ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget);
        if (data.getAll('_imagesPending').includes('true')) {
          setFailed(true);
          setMessage('กรุณารอให้อัปโหลดรูปเสร็จก่อนบันทึก');
          return;
        }
        setMessage('');
        start(async () => {
          try {
            const result = await action(data);
            setFailed(Boolean(result.error));
            setMessage(result.error || 'บันทึกเรียบร้อยแล้ว');
            if (result.success) {
              if (result.redirectTo) router.push(result.redirectTo);
              if (resetOnSuccess) formRef.current?.reset();
              router.refresh();
              onSuccess?.();
            }
          } catch {
            setFailed(true);
            setMessage('การเชื่อมต่อขัดข้อง กรุณาลองใหม่');
          }
        });
      }}
    >
      <fieldset disabled={pending || !ready} className="space-y-4">
        {children}
      </fieldset>
      {message ? (
        <p
          role={failed ? 'alert' : 'status'}
          className={`rounded-lg p-3 text-sm ${failed ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {message}
        </p>
      ) : null}
      <button className="btn" disabled={pending || !ready}>
        {pending ? (
          <>
            <LoaderCircle size={16} className="animate-spin" />
            กำลังบันทึก...
          </>
        ) : (
          label
        )}
      </button>
    </form>
  );
}
