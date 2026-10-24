import type { AppUser, Prisma, Role } from '@prisma/client';
import { UserError } from './validation';

export async function updateManagedUser(
  tx: Prisma.TransactionClient,
  actor: Pick<AppUser, 'id' | 'role' | 'active'>,
  input: { id: string; role: Role; active: boolean },
) {
  if (!actor.active || actor.role !== 'ADMIN') throw new UserError('คุณไม่มีสิทธิ์จัดการผู้ใช้');
  if (input.id === actor.id) throw new UserError('เปลี่ยนสิทธิ์หรือระงับบัญชีตัวเองไม่ได้');
  const current = await tx.appUser.findUnique({
    where: { id: input.id },
    include: { technician: true },
  });
  if (!current) throw new UserError('ไม่พบผู้ใช้');
  if (
    current.role !== input.role &&
    (await tx.booking.count({
      where: { customerId: current.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    }))
  )
    throw new UserError('ผู้ใช้มีงานค้างอยู่ กรุณาจบงานก่อนเปลี่ยนบทบาท');
  if (
    current.role === 'ADMIN' &&
    (input.role !== 'ADMIN' || !input.active) &&
    (await tx.appUser.count({ where: { role: 'ADMIN', active: true } })) <= 1
  )
    throw new UserError('ต้องมี Admin ที่ใช้งานได้อย่างน้อยหนึ่งคน');
  if (
    input.role === 'TECHNICIAN' &&
    current.role !== 'TECHNICIAN' &&
    current.technician &&
    ['PENDING', 'REJECTED'].includes(current.technician.applicationStatus)
  )
    throw new UserError('กรุณาตรวจและอนุมัติใบสมัครจากหน้าจัดการช่างก่อนเปลี่ยนเป็นช่าง');
  if (current.technician && (input.role !== 'TECHNICIAN' || !input.active)) {
    if (
      await tx.booking.count({
        where: {
          technicianId: current.technician.id,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      })
    )
      throw new UserError('ช่างมีงานค้างอยู่ กรุณาจัดการงานก่อนเปลี่ยนสิทธิ์หรือระงับ');
    // Pausing access must preserve the applicant, photos and booking history.
    await tx.technician.update({
      where: { id: current.technician.id },
      data: { active: false },
    });
  }
  await tx.appUser.update({
    where: { id: input.id },
    data: { role: input.role, active: input.active },
  });
}
