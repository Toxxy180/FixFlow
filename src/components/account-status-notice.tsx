'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export function AccountStatusNotice({ initialMessage }: { initialMessage: string }) {
  const [message, setMessage] = useState(initialMessage);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => setMessage(initialMessage), [initialMessage]);
  useEffect(() => {
    let stopped = false;
    let checking = false;
    const check = async () => {
      if (document.hidden || checking) return;
      checking = true;
      try {
        const response = await fetch('/api/account-status', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { message: string };
        if (!stopped) {
          setMessage(data.message);
          if (data.message !== message) router.refresh();
          if (data.message && pathname !== '/account-status') router.replace('/account-status');
        }
      } catch {
        /* The server still checks access for every protected operation. */
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(check, 30000);
    window.addEventListener('focus', check);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [message, pathname, router]);
  return message ? (
    <div
      role="alert"
      className="border-b border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm text-amber-900"
    >
      {message}{' '}
      <Link href="/account-status" className="font-semibold underline">
        ดูสถานะบัญชี
      </Link>
    </div>
  ) : null;
}
