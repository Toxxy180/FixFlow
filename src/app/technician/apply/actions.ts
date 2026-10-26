'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { submitTechnicianApplication } from '@/lib/technician-application';
import { UserError } from '@/lib/validation';
import type { ActionResult } from '@/lib/types';

export async function applyAsTechnician(form: FormData): Promise<ActionResult> {
  const user = await requireUser('/technician/apply');
  try {
    await submitTechnicianApplication(user, {
      ...Object.fromEntries(form),
      districtIds: form.getAll('districtIds'),
      workDays: form.getAll('workDays'),
      availableTimes: form.getAll('availableTimes'),
      portfolioPaths: form.getAll('portfolioPaths'),
    });
    updateTag('public-catalog');
    revalidatePath('/', 'layout');
    return { success: true, redirectTo: '/account' };
  } catch (error) {
    return {
      error: error instanceof UserError ? error.message : 'ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่',
    };
  }
}
