import type { Prisma } from '@prisma/client';
import { isAccountAllowed } from './account-status';
import { technicianApplicationSchema } from './technician-application';
import { UserError } from './validation';
import { MAX_PORTFOLIO_IMAGES, validImagePath } from './images';
import { z } from 'zod';

export const technicianProfileSchema = technicianApplicationSchema
  .omit({ phone: true, portfolioPaths: true })
  .extend({
    portfolioPaths: z
      .array(z.string().refine((path) => validImagePath(path)))
      .max(MAX_PORTFOLIO_IMAGES)
      .optional(),
  })
  .strict();

export async function updateTechnicianProfile(
  tx: Prisma.TransactionClient,
  ownerId: string,
  input: unknown,
) {
  const parsed = technicianProfileSchema.safeParse(input);
  if (!parsed.success)
    throw new UserError('กรุณากรอกข้อมูลรับงาน เลือกพื้นที่ วันและเวลาให้ครบ และตรวจสอบลิงก์ผลงาน');
  const user = await tx.appUser.findUnique({
    where: { id: ownerId },
    include: { technician: true },
  });
  if (!user || !isAccountAllowed(user) || user.role !== 'TECHNICIAN')
    throw new UserError('เฉพาะบัญชีช่างที่เปิดใช้งานเท่านั้น');
  const technician = user.technician;
  if (!technician || !['APPROVED', 'NONE'].includes(technician.applicationStatus))
    throw new UserError('กรุณารอ Admin อนุมัติใบสมัครก่อนแก้ไขข้อมูลรับงาน');
  const { districtIds, workDays, availableTimes, portfolioPaths, ...profile } = parsed.data;
  const paths = portfolioPaths === undefined ? undefined : [...new Set(portfolioPaths)];
  const obsoletePaths: string[] = [];
  if (paths) {
    const images = await tx.userImage.findMany({
      where: { ownerId, kind: 'PORTFOLIO' },
      select: { path: true },
    });
    if (
      paths.some((path) => !validImagePath(path, ownerId)) ||
      paths.some((path) => !images.some((image) => image.path === path))
    )
      throw new UserError('รูปผลงานไม่ถูกต้องหรือไม่ใช่รูปที่คุณอัปโหลด');
    obsoletePaths.push(
      ...images.filter((image) => !paths.includes(image.path)).map((image) => image.path),
    );
  }
  const ids = [...new Set(districtIds)];
  const [districts, category] = await Promise.all([
    tx.district.findMany({ where: { id: { in: ids } }, orderBy: { name: 'asc' } }),
    tx.serviceCategory.findUnique({ where: { id: profile.category } }),
  ]);
  if (
    districts.length !== ids.length ||
    !category ||
    (!category.active && category.id !== technician.category)
  )
    throw new UserError('พื้นที่หรือประเภทช่างไม่ถูกต้อง หรือประเภทช่างนี้ปิดใช้งานแล้ว');
  // Resolve ownership from the signed-in account; profile edits never grant approval or activation.
  await tx.technician.update({
    where: { id: technician.id },
    data: {
      ...profile,
      initials: Array.from(profile.name).slice(0, 2).join(''),
      district: districts[0].name,
      workDays: [...new Set(workDays)],
      availableTimes: [...new Set(availableTimes)],
      ...(paths ? { portfolioPaths: paths } : {}),
    },
  });
  await tx.technicianDistrict.deleteMany({ where: { technicianId: technician.id } });
  await tx.technicianDistrict.createMany({
    data: ids.map((districtId) => ({ technicianId: technician.id, districtId })),
  });
  if (paths)
    await tx.userImage.deleteMany({
      where: { ownerId, kind: 'PORTFOLIO', path: { notIn: paths } },
    });
  await tx.auditLog.create({
    data: { actorId: ownerId, action: 'UPDATE_OWN_TECHNICIAN', targetId: technician.id },
  });
  return { id: technician.id, obsoletePaths };
}
