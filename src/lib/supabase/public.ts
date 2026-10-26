import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { hasSupabase } from '@/lib/config';

// A cookie-free client uses only the publishable key and Storage's public-read policy.
export function createPublicClient() {
  if (!hasSupabase()) throw new Error('Supabase is not configured');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}
