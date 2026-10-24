'use server';
import { Prisma, JobStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import {
  bookJob,
  cancelJob,
  advanceJob,
  addJobPart,
  removeJobPart,
  payDemoJob,
  reviewJob,
} from '@/lib/booking-service';
import { UserError } from '@/lib/validation';
import type { ActionResult } from '@/lib/types';

async function run(operation: () => Promise<unknown>, id?: string): Promise<ActionResult> {
  try {
    await operation();
    for (const path of ['/bookings', '/technician', '/admin', '/admin/bookings', '/'])
      revalidatePath(path);
    if (id) revalidatePath(`/bookings/${id}`);
    return { success: true };
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { error: 'ช่วงเวลานี้ถูกจองแล้ว หรือรายการนี้ถูกบันทึกไปแล้ว กรุณาตรวจสอบและลองใหม่' };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
      return { error: 'มีการแก้ไขพร้อมกัน กรุณาลองใหม่อีกครั้ง' };
    console.error('FixFlow operation failed', error instanceof Error ? error.name : 'Unknown');
    return { error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' };
  }
}

export async function createBooking(formData: FormData): Promise<ActionResult> {
  const user = await requireUser('/bookings');
  let reference = '';
  const result = await run(async () => {
    const booking = await bookJob(user, Object.fromEntries(formData));
    reference = booking.reference;
  });
  return result.error ? result : { success: true, reference };
}
export async function cancelBooking(id: string) {
  const user = await requireUser();
  return run(() => cancelJob(user, id), id);
}
export async function changeJobStatus(id: string, status: string) {
  const user = await requireUser('/technician');
  if (!z.enum(JobStatus).safeParse(status).success) return { error: 'สถานะไม่ถูกต้อง' };
  return run(() => advanceJob(user, id, status as JobStatus), id);
}
export async function addPart(formData: FormData) {
  const user = await requireUser('/technician');
  const id = String(formData.get('bookingId') || '');
  return run(
    () =>
      addJobPart(
        user,
        id,
        String(formData.get('name') || ''),
        Number(formData.get('quantity')),
        Number(formData.get('unitPrice')),
      ),
    id,
  );
}
export async function removePart(id: string, partId: string) {
  const user = await requireUser('/technician');
  return run(() => removeJobPart(user, id, partId), id);
}
export async function payDemo(id: string) {
  const user = await requireUser();
  return run(() => payDemoJob(user, id), id);
}
export async function submitReview(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('bookingId') || '');
  return run(
    () =>
      reviewJob(user, id, Number(formData.get('rating')), String(formData.get('comment') || '')),
    id,
  );
}
