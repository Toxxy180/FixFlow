import { hasSupabase } from '@/lib/config';
import { AuthPageShell } from '@/components/auth-page-shell';
import { LoginForm } from '@/components/login-form';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <AuthPageShell>
      <LoginForm
        mode="forgot"
        configured={hasSupabase()}
        notice={
          params.error === 'recovery'
            ? 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่'
            : ''
        }
      />
    </AuthPageShell>
  );
}
