'use server';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { times } from '@/lib/constants';
import { UserError } from '@/lib/validation';
import type { ActionResult } from '@/lib/types';
import { isAccountAllowed } from '@/lib/account-status';
import { managedUserSchema, updateManagedUser } from '@/lib/user-management';
import {
  approveTechnicianApplication,
  rejectTechnicianApplication,
} from '@/lib/technician-application';

export async function approveTechnician(id: string): Promise<ActionResult> {
  return mutate('APPROVE_TECHNICIAN', id, (tx) => approveTechnicianApplication(tx, id));
}
export async function rejectTechnician(form: FormData): Promise<ActionResult> {
  const id = String(form.get('id') || '');
  return mutate('REJECT_TECHNICIAN', id, (tx) =>
    rejectTechnicianApplication(tx, id, String(form.get('note') || '')),
  );
}

async function mutate(
  action: string,
  targetId: string,
  operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
): Promise<ActionResult> {
  const user = await requireRole('ADMIN', '/admin');
  try {
    await prisma.$transaction(
      async (tx) => {
        await operation(tx);
        await tx.auditLog.create({ data: { actorId: user.id, action, targetId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
    );
    updateTag('public-catalog');
    revalidatePath('/', 'layout');
    revalidatePath('/admin', 'layout');
    return { success: true };
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      return { error: 'ข้อมูลนี้ซ้ำกับรายการเดิม หรือบัญชีช่างถูกเชื่อมไว้แล้ว' };
    return { error: 'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่' };
  }
}

export async function saveService(form: FormData): Promise<ActionResult> {
  await requireRole('ADMIN', '/admin/services');
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(100),
      description: z.string().trim().max(500),
      categoryId: z.string().min(1),
      price: z.coerce.number().int().min(0).max(100000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'กรุณากรอกชื่อบริการ หมวดหมู่ และราคาที่ถูกต้อง' };
  const id = String(form.get('id') || '') || `service-${randomBytes(6).toString('hex')}`;
  return mutate('SAVE_SERVICE', id, async (tx) => {
    if (!(await tx.serviceCategory.findUnique({ where: { id: parsed.data.categoryId } })))
      throw new UserError('ไม่พบหมวดหมู่');
    return tx.service.upsert({
      where: { id },
      update: { ...parsed.data, active: form.get('active') === 'on' },
      create: { id, ...parsed.data, active: form.get('active') === 'on' },
    });
  });
}

export async function saveCategory(form: FormData): Promise<ActionResult> {
  await requireRole('ADMIN', '/admin/services');
  const name = String(form.get('name') || '').trim();
  if (name.length < 2 || name.length > 60) return { error: 'ชื่อหมวดหมู่ต้องยาว 2–60 ตัวอักษร' };
  const id = String(form.get('id') || '') || `category-${randomBytes(4).toString('hex')}`;
  return mutate('SAVE_CATEGORY', id, (tx) =>
    tx.serviceCategory.upsert({
      where: { id },
      update: { name, active: form.get('active') === 'on' },
      create: { id, name, active: form.get('active') === 'on' },
    }),
  );
}

export async function saveTechnician(form: FormData): Promise<ActionResult> {
  await requireRole('ADMIN', '/admin/technicians');
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      initials: z.string().trim().min(1).max(4),
      description: z.string().trim().min(5).max(500),
      category: z.string().min(1),
      price: z.coerce.number().int().min(0).max(100000),
      experience: z.coerce.number().int().min(0).max(60),
      color: z.enum(['blue', 'amber', 'teal', 'purple']),
    })
    .safeParse(Object.fromEntries(form));
  const districtIds = [...new Set(form.getAll('districtIds').map(String))];
  const workDays = [...new Set(form.getAll('workDays').map(Number))];
  const availableTimes = [...new Set(form.getAll('availableTimes').map(String))];
  if (
    !parsed.success ||
    !districtIds.length ||
    !workDays.length ||
    workDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    !availableTimes.length ||
    availableTimes.some((t) => !times.includes(t as (typeof times)[number]))
  )
    return { error: 'กรุณากรอกข้อมูลช่าง เลือกพื้นที่ วันทำงาน และช่วงเวลาให้ครบ' };
  const userId = String(form.get('userId') || '') || null;
  if (userId && !z.uuid().safeParse(userId).success) return { error: 'บัญชีช่างไม่ถูกต้อง' };
  const id = String(form.get('id') || '') || `tech-${randomBytes(6).toString('hex')}`;
  return mutate('SAVE_TECHNICIAN', id, async (tx) => {
    const [areas, category, linkedUser, existing] = await Promise.all([
      tx.district.findMany({ where: { id: { in: districtIds } } }),
      tx.serviceCategory.findUnique({ where: { id: parsed.data.category } }),
      userId ? tx.appUser.findUnique({ where: { id: userId } }) : Promise.resolve(null),
      tx.technician.findUnique({ where: { id } }),
    ]);
    if (areas.length !== districtIds.length || !category)
      throw new UserError('เขตหรือหมวดหมู่ไม่ถูกต้อง');
    const pendingApplication =
      existing?.userId === userId &&
      ['PENDING', 'REJECTED'].includes(existing?.applicationStatus || '') &&
      !!userId;
    if (userId && (!isAccountAllowed(linkedUser) || linkedUser?.role !== 'TECHNICIAN'))
      throw new UserError('ต้องเลือกผู้ใช้ที่มีสิทธิ์ช่างและยังเปิดใช้งาน');
    if (pendingApplication && form.get('active') === 'on')
      throw new UserError('ใบสมัครนี้รออนุมัติ กรุณาใช้ปุ่มอนุมัติและเปิดรับงาน');
    if (
      existing &&
      existing.userId !== userId &&
      (await tx.booking.count({
        where: { technicianId: id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }))
    )
      throw new UserError('มีงานค้างอยู่ กรุณาจบงานก่อนเปลี่ยนบัญชีช่าง');
    const data = {
      ...parsed.data,
      district: areas[0].name,
      active: form.get('active') === 'on',
      userId,
      workDays,
      availableTimes,
    };
    await tx.technician.upsert({
      where: { id },
      update: data,
      create: { id, ...data, applicationStatus: userId ? 'APPROVED' : 'NONE' },
    });
    await tx.technicianDistrict.deleteMany({ where: { technicianId: id } });
    await tx.technicianDistrict.createMany({
      data: districtIds.map((districtId) => ({ technicianId: id, districtId })),
    });
  });
}

export async function saveUser(form: FormData): Promise<ActionResult> {
  const actor = await requireRole('ADMIN', '/admin/users');
  if (form.has('role')) return { error: 'ไม่อนุญาตให้เปลี่ยนบทบาทผู้ใช้จากหน้านี้' };
  const parsed = managedUserSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { status, until, reason } = parsed.data;
  const action = [
    'ACCOUNT_' + status,
    status === 'SUSPENDED' ? until + ' (Asia/Bangkok)' : '',
    reason,
  ]
    .filter(Boolean)
    .join(' · ');
  return mutate(action, parsed.data.id, (tx) => updateManagedUser(tx, actor, parsed.data));
}

export async function saveSettings(form: FormData): Promise<ActionResult> {
  await requireRole('ADMIN', '/admin/settings');
  const parsed = z
    .object({
      maxAdvanceDays: z.coerce.number().int().min(1).max(90),
      cancelBeforeHours: z.coerce.number().int().min(0).max(72),
      travelFee: z.coerce.number().int().min(0).max(10000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'กรุณาตรวจสอบเงื่อนไขการจอง' };
  return mutate('SAVE_SETTINGS', 'main', (tx) =>
    tx.appSetting.update({
      where: { id: 'main' },
      data: { ...parsed.data, bookingEnabled: form.get('bookingEnabled') === 'on' },
    }),
  );
}

export async function archiveItem(
  kind: 'TECHNICIAN' | 'SERVICE',
  id: string,
): Promise<ActionResult> {
  return mutate(`ARCHIVE_${kind}`, id, (tx) =>
    kind === 'TECHNICIAN'
      ? tx.technician.update({ where: { id }, data: { active: false } })
      : tx.service.update({ where: { id }, data: { active: false } }),
  );
}
