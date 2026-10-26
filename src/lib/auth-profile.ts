import 'server-only';
import type { User } from '@supabase/supabase-js';
import type { AppUser } from '@prisma/client';
import { prisma } from './prisma';
import { signupDestination, verifiedProfileData } from './auth-validation';

export async function syncVerifiedProfile(user: User) {
  const data = verifiedProfileData(user);
  const existing = await prisma.appUser.findUnique({ where: { id: data.id } });
  if (existing) {
    if (existing.email === data.email) return existing;
    return prisma.appUser.update({ where: { id: data.id }, data: { email: data.email } });
  }
  const intent = await prisma.registrationIntent.findUnique({ where: { id: data.id } });
  const trusted =
    intent &&
    intent.email === data.email &&
    (intent.role === 'CUSTOMER' || intent.role === 'TECHNICIAN');
  return prisma.appUser.upsert({
    where: { id: data.id },
    update: {},
    create: {
      ...data,
      role: trusted ? intent.role : 'CUSTOMER',
      phone: trusted ? intent.phone : '',
    },
  });
}

export async function destinationAfterAuth(
  profile: Pick<AppUser, 'id' | 'role'>,
  signupType: unknown,
) {
  const application =
    profile.role === 'TECHNICIAN'
      ? await prisma.technician.findUnique({
          where: { userId: profile.id },
          select: { applicationStatus: true },
        })
      : null;
  return signupDestination(profile.role, signupType, application?.applicationStatus);
}
