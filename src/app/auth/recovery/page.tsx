import { redirect } from 'next/navigation';
import { RecoveryConfirm } from '@/components/recovery-confirm';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'ตั้งรหัสผ่านใหม่ | FixFlow',
  robots: { index: false, follow: false },
};
export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; code?: string }>;
}) {
  const { token_hash, code } = await searchParams;
  // Keep previously configured ConfirmationURL / PKCE emails working in their original browser.
  if (typeof code === 'string' && code.length > 0 && code.length < 2048)
    redirect('/auth/callback?code=' + encodeURIComponent(code));
  if (typeof token_hash !== 'string' || !/^[a-f0-9]{64}$/i.test(token_hash))
    redirect('/forgot-password?error=recovery');
  // Email scanners may open links. Consume the token only after an explicit form submission.
  return (
    <main className="shell min-h-[65dvh] py-12">
      <RecoveryConfirm tokenHash={token_hash} />
    </main>
  );
}
