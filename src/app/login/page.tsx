import { redirect } from 'next/navigation';
import { getCurrentUser, getAuthIdentity } from '@/lib/auth';
import { hasSupabase, isDemoMode } from '@/lib/config';
import { LoginForm } from '@/components/login-form';
import { AuthPageShell } from '@/components/auth-page-shell';
import { googleAuthEnabled } from '@/lib/auth-providers';
import { destinationAfterAuth } from '@/lib/auth-profile';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, googleEnabled, params] = await Promise.all([
    getCurrentUser(),
    googleAuthEnabled(),
    searchParams,
  ]);
  if (user)
    redirect(
      await destinationAfterAuth(user, (await getAuthIdentity())?.user_metadata?.signup_type),
    );
  const notice =
    params.message === 'password-updated'
      ? 'บันทึกรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่'
      : params.error === 'google'
        ? 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่หรือใช้อีเมลและรหัสผ่าน'
        : params.error === 'suspended'
          ? 'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ'
          : '';
  return (
    <AuthPageShell>
      <LoginForm
        demo={isDemoMode()}
        configured={hasSupabase()}
        googleEnabled={googleEnabled}
        notice={notice}
      />
    </AuthPageShell>
  );
}
