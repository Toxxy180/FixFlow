import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { hasSupabase, isDemoMode, safeNext } from './config';
import { syncVerifiedProfile } from './auth-profile';

export const demoIds: Record<string, string> = {
  CUSTOMER: '00000000-0000-4000-8000-000000000001',
  TECHNICIAN: '00000000-0000-4000-8000-000000000002',
  ADMIN: '00000000-0000-4000-8000-000000000003',
};

export const getAuthIdentity = cache(async () => {
  if (!hasSupabase()) return null;
  const {
    data: { user },
    error,
  } = await (await createClient()).auth.getUser();
  return !error && user?.email && user.email_confirmed_at ? user : null;
});

export const getCurrentUser = cache(async () => {
  if (isDemoMode()) {
    const role = (await cookies()).get('fixflow-demo')?.value;
    if (!role || !Object.hasOwn(demoIds, role)) return null;
    return prisma.appUser.findFirst({ where: { id: demoIds[role], active: true } });
  }
  if (!hasSupabase()) return null;
  const user = await getAuthIdentity();
  if (!user) return null;
  const profile = await syncVerifiedProfile(user);
  return profile.active ? profile : null;
});

export async function requireUser(next = '/bookings') {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return user;
}
export async function requireRole(role: Role, next: string) {
  const user = await requireUser(next);
  if (user.role !== role) redirect('/forbidden');
  return user;
}
