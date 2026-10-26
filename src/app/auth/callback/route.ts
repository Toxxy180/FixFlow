import { isAccountAllowed } from '@/lib/account-status';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { destinationAfterAuth, syncVerifiedProfile } from '@/lib/auth-profile';
import { applicationOrigin } from '@/lib/auth-validation';
import { issueRecoveryTicket } from '@/lib/auth-recovery';

export async function GET(request: Request) {
  const url = new URL(request.url);
  let destination = '/login?error=auth';
  try {
    const code = url.searchParams.get('code');
    if (code && code.length <= 4096 && !url.searchParams.has('error')) {
      const client = await createClient();
      let isRecovery = false;
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') isRecovery = true;
      });
      const { data, error } = await client.auth
        .exchangeCodeForSession(code)
        .finally(() => subscription.unsubscribe());
      if (!error && data.user?.email_confirmed_at) {
        const profile = await syncVerifiedProfile(data.user);
        if (!isAccountAllowed(profile)) {
          destination = '/account-status';
        } else if (isRecovery) {
          // Only the verified PKCE recovery exchange grants permission to reset a password.
          await issueRecoveryTicket(data.user.id);
          destination = '/reset-password';
        } else
          destination = await destinationAfterAuth(profile, data.user.user_metadata?.signup_type);
      }
    }
  } catch {
    /* Return a fixed message; never reflect provider errors or tokens in the page. */
  }
  const response = NextResponse.redirect(new URL(destination, applicationOrigin()));
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
