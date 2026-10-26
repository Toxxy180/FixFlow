import type { Prisma } from '@prisma/client';

type AccountAccess = { active: boolean; suspendedUntil?: Date | null; suspensionReason?: string };
export function accountStatus(user: AccountAccess, now = new Date()) {
  if (!user.active) return 'DISABLED' as const;
  if (user.suspendedUntil && user.suspendedUntil > now) return 'SUSPENDED' as const;
  return 'ACTIVE' as const;
}
export function isAccountAllowed(user: AccountAccess | null | undefined, now = new Date()) {
  return Boolean(user && accountStatus(user, now) === 'ACTIVE');
}
export const accountStatusLabels = {
  ACTIVE: 'เปิดใช้งาน',
  DISABLED: 'ปิดบัญชี',
  SUSPENDED: 'ระงับชั่วคราว',
};
export function accountRestriction(user: AccountAccess) {
  const status = accountStatus(user);
  if (status === 'ACTIVE') return '';
  const until =
    status === 'SUSPENDED' && user.suspendedUntil
      ? `ถึง ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(user.suspendedUntil)} น. (เวลาไทย)`
      : '';
  return `${status === 'DISABLED' ? 'บัญชีนี้ถูกปิดใช้งาน' : 'บัญชีนี้ถูกระงับชั่วคราว'} ${until}${user.suspensionReason ? ` · เหตุผล: ${user.suspensionReason}` : ''} กรุณาติดต่อผู้ดูแลระบบ`;
}
export function activeAccountWhere(now = new Date()): Prisma.AppUserWhereInput {
  return { active: true, OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: now } }] };
}
