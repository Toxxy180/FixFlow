import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasRecoveryTicket } from '@/lib/auth-recovery';
import { hasSupabase } from '@/lib/config';
import { AuthPageShell } from '@/components/auth-page-shell';
import { LoginForm } from '@/components/login-form';

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user || !(await hasRecoveryTicket(user.id))) {
    redirect('/forgot-password?error=recovery');
  }
  return (
    <AuthPageShell>
      <LoginForm mode="forgot" initialStep="RESET" configured={hasSupabase()} />
    </AuthPageShell>
  );
}
