import 'server-only';
import type { User } from '@supabase/supabase-js';
import type { AppUser } from '@prisma/client';
import { prisma } from './prisma';
import { signupDestination, verifiedProfileData } from './auth-validation';

export async function syncVerifiedProfile(user: User) {
  const data = verifiedProfileData(user);
  return prisma.appUser.upsert({
    where: { id: data.id },
    update: { email: data.email },
    create: data,
  });
}

export async function destinationAfterAuth(
  profile: Pick<AppUser, 'id' | 'role'>,
  signupType: unknown,
) {
  const application =
    profile.role === 'CUSTOMER' && signupType === 'TECHNICIAN'
      ? await prisma.technician.findUnique({
          where: { userId: profile.id },
          select: { applicationStatus: true },
        })
      : null;
  return signupDestination(profile.role, signupType, application?.applicationStatus);
}
