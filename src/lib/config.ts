export const hasSupabase = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export function isDemoMode() {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.VERCEL ||
    process.env.DEMO_AUTH !== 'true' ||
    hasSupabase()
  )
    return false;
  try {
    return ['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL || '').hostname);
  } catch {
    return false;
  }
}
export function safeNext(value?: string | null) {
  if (value === '/') return '/';
  if (
    !value ||
    !/^\/(bookings(?:\/[^/?#]+)?|account|choose-role|admin(?:\/[a-z]+)?|technician(?:\/(?:apply|profile))?)$/.test(
      value,
    )
  )
    return '/bookings';
  return value;
}
