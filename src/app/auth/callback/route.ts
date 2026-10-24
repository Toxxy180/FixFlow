import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { destinationAfterAuth, syncVerifiedProfile } from '@/lib/auth-profile';
import { applicationOrigin } from '@/lib/auth-validation';

export async function GET(request: Request) {
  const url = new URL(request.url);
  let destination = '/login?error=google';
  const jar = await cookies();
  const kind = jar.get('fixflow-signup-kind')?.value;
  jar.delete('fixflow-signup-kind');
  try {
    const code = url.searchParams.get('code');
    if (code && code.length <= 4096 && !url.searchParams.has('error')) {
      const client = await createClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error && data.user?.email_confirmed_at) {
        const profile = await syncVerifiedProfile(data.user);
        if (!profile.active) {
          await client.auth.signOut();
          destination = '/login?error=suspended';
        } else
          destination = await destinationAfterAuth(
            profile,
            kind === 'CUSTOMER' || kind === 'TECHNICIAN'
              ? kind
              : data.user.user_metadata?.signup_type,
          );
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
