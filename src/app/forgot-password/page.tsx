import { hasSupabase } from '@/lib/config';
import { AuthPageShell } from '@/components/auth-page-shell';
import { LoginForm } from '@/components/login-form';

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell>
      <LoginForm mode="forgot" configured={hasSupabase()} />
    </AuthPageShell>
  );
}
