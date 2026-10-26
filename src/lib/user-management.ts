import type { AppUser, Prisma } from '@prisma/client';
import { z } from 'zod';
import { UserError } from './validation';
import { isAccountAllowed } from './account-status';

export const managedUserSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(['ACTIVE', 'DISABLED', 'SUSPENDED']),
    reason: z.string().trim().max(500).default(''),
    until: z.string().max(30).default(''),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.status !== 'ACTIVE' && v.reason.length < 3)
      ctx.addIssue({
        code: 'custom',
        message: 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร',
        path: ['reason'],
      });
    if (
      v.status === 'SUSPENDED' &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.until) ||
        !Number.isFinite(new Date(v.until + ':00+07:00').getTime()))
    )
      ctx.addIssue({ code: 'custom', message: 'กรุณาระบุวันเวลาสิ้นสุดการระงับ', path: ['until'] });
  });

export async function updateManagedUser(
  tx: Prisma.TransactionClient,
  actor: Pick<AppUser, 'id' | 'role' | 'active'> & { suspendedUntil?: Date | null },
  input: z.input<typeof managedUserSchema>,
) {
  if (!isAccountAllowed(actor) || actor.role !== 'ADMIN')
    throw new UserError('คุณไม่มีสิทธิ์จัดการผู้ใช้');
  const parsed = managedUserSchema.safeParse(input);
  if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
  const data = parsed.data;
  if (data.id === actor.id) throw new UserError('เปลี่ยนสถานะบัญชีตัวเองไม่ได้');
  const current = await tx.appUser.findUnique({ where: { id: data.id } });
  if (!current) throw new UserError('ไม่พบผู้ใช้');
  if (current.role === 'ADMIN') throw new UserError('หน้านี้ไม่อนุญาตให้เปลี่ยนสถานะบัญชี Admin');
  const suspendedUntil = data.status === 'SUSPENDED' ? new Date(data.until + ':00+07:00') : null;
  if (suspendedUntil && suspendedUntil <= new Date())
    throw new UserError('วันสิ้นสุดการระงับต้องเป็นเวลาในอนาคต');
  // Keep roles, approval, photos and history intact. Expiry is checked on every request.
  await tx.appUser.update({
    where: { id: data.id },
    data: {
      active: data.status !== 'DISABLED',
      suspendedUntil,
      suspensionReason: data.status === 'ACTIVE' ? '' : data.reason,
    },
  });
}
