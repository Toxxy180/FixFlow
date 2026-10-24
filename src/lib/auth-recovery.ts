import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const cookieName = 'fixflow-recovery';
function ticketKey(userId: string, ticket: string) {
  return `recovery:${userId}:${createHash('sha256').update(ticket).digest('hex')}`;
}
export async function issueRecoveryTicket(userId: string) {
  const ticket = randomBytes(32).toString('hex');
  await prisma.rateLimit.create({
    data: {
      key: ticketKey(userId, ticket),
      count: 1,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  (await cookies()).set(cookieName, ticket, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
}
export async function consumeRecoveryTicket(userId: string) {
  const jar = await cookies();
  const ticket = jar.get(cookieName)?.value;
  if (!ticket || !/^[a-f0-9]{64}$/.test(ticket)) return false;
  const result = await prisma.rateLimit.deleteMany({
    where: { key: ticketKey(userId, ticket), expiresAt: { gt: new Date() } },
  });
  jar.delete(cookieName);
  return result.count === 1;
}
