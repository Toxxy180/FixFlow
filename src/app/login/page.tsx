import { redirect } from 'next/navigation';
import { getCurrentUser, getAuthIdentity } from '@/lib/auth';
import { hasSupabase, isDemoMode } from '@/lib/config';
import { LoginForm } from '@/components/login-form';
import { AuthPageShell } from '@/components/auth-page-shell';
import { destinationAfterAuth } from '@/lib/auth-profile';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (user)
    redirect(
      await destinationAfterAuth(user, (await getAuthIdentity())?.user_metadata?.signup_type),
    );
  const notice =
    params.message === 'password-updated'
      ? 'บันทึกรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่'
      : params.error === 'auth'
        ? 'ยืนยันตัวตนไม่สำเร็จ ลิงก์อาจหมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน หรือเริ่มเข้าสู่ระบบอีกครั้ง'
        : params.error === 'suspended'
          ? 'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ'
          : '';
  return (
    <AuthPageShell>
      <LoginForm demo={isDemoMode()} configured={hasSupabase()} notice={notice} />
    </AuthPageShell>
  );
}
