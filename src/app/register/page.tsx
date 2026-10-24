import { redirect } from 'next/navigation';
import { getCurrentUser, getAuthIdentity } from '@/lib/auth';
import { hasSupabase } from '@/lib/config';
import { googleAuthEnabled } from '@/lib/auth-providers';
import { AuthPageShell } from '@/components/auth-page-shell';
import { LoginForm } from '@/components/login-form';
import { destinationAfterAuth } from '@/lib/auth-profile';

export default async function RegisterPage() {
  const [user, googleEnabled] = await Promise.all([getCurrentUser(), googleAuthEnabled()]);
  if (user)
    redirect(
      await destinationAfterAuth(user, (await getAuthIdentity())?.user_metadata?.signup_type),
    );
  return (
    <AuthPageShell>
      <LoginForm mode="register" configured={hasSupabase()} googleEnabled={googleEnabled} />
    </AuthPageShell>
  );
}
