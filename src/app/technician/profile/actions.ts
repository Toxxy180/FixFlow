'use server';
import { Prisma } from '@prisma/client';
import { revalidatePath, updateTag } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateTechnicianProfile } from '@/lib/technician-profile';
import { UserError } from '@/lib/validation';
import type { ActionResult } from '@/lib/types';

export async function saveMyTechnicianProfile(form: FormData): Promise<ActionResult> {
  const user = await requireRole('TECHNICIAN', '/technician/profile');
  try {
    const id = await prisma.$transaction(
      (tx) =>
        updateTechnicianProfile(tx, user.id, {
          ...Object.fromEntries(form),
          districtIds: form.getAll('districtIds'),
          workDays: form.getAll('workDays'),
          availableTimes: form.getAll('availableTimes'),
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
    );
    updateTag('public-catalog');
    for (const path of [
      '/technician/profile',
      '/technician',
      '/account',
      '/admin/technicians',
      `/admin/technicians/${id}`,
      `/technicians/${id}`,
      '/admin/settings',
      '/admin/users',
    ])
      revalidatePath(path);
    return { success: true };
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
      return { error: 'มีการแก้ไขพร้อมกัน กรุณาลองบันทึกอีกครั้ง' };
    console.error(
      'Technician profile update failed',
      error instanceof Error ? error.name : 'Unknown',
    );
    return { error: 'บันทึกข้อมูลรับงานไม่สำเร็จ กรุณาลองใหม่' };
  }
}
