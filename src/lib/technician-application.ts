import { Prisma, type AppUser } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './prisma';
import { times } from './constants';
import { UserError } from './validation';
import { validImagePath, MAX_PORTFOLIO_IMAGES } from './images';

export const technicianApplicationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^0\d{9}$/),
  category: z.string().min(1),
  description: z.string().trim().min(5).max(500),
  price: z.coerce.number().int().min(0).max(100000),
  experience: z.coerce.number().int().min(0).max(60),
  districtIds: z
    .array(z.string().regex(/^10\d{2}$/))
    .min(1)
    .max(50),
  workDays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
  availableTimes: z.array(z.enum(times)).min(1).max(times.length),
  portfolioPaths: z
    .array(z.string().refine((path) => validImagePath(path)))
    .min(1)
    .max(MAX_PORTFOLIO_IMAGES),
  portfolioUrl: z
    .string()
    .trim()
    .max(500)
    .default('')
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
      } catch {
        return false;
      }
    }),
});

export async function submitTechnicianApplication(actor: Pick<AppUser, 'id'>, input: unknown) {
  const parsed = technicianApplicationSchema.safeParse(input);
  if (!parsed.success)
    throw new UserError('กรุณากรอกข้อมูลให้ครบ แนบรูป 1–5 รูป และใช้ลิงก์ผลงานที่ถูกต้อง');
  const { districtIds, workDays, availableTimes, phone, portfolioPaths, ...profile } = parsed.data;
  return prisma.$transaction(
    async (tx) => {
      const user = await tx.appUser.findUnique({
        where: { id: actor.id },
        include: { technician: true },
      });
      if (!user?.active || user.role !== 'CUSTOMER')
        throw new UserError('สมัครช่างได้จากบัญชีลูกค้าที่เปิดใช้งานเท่านั้น');
      if (user.technician?.applicationStatus === 'APPROVED')
        throw new UserError('ใบสมัครนี้ได้รับอนุมัติแล้ว');
      const ids = [...new Set(districtIds)];
      const paths = [...new Set(portfolioPaths)];
      const [districts, category, images] = await Promise.all([
        tx.district.findMany({ where: { id: { in: ids } } }),
        tx.serviceCategory.findFirst({ where: { id: profile.category, active: true } }),
        tx.userImage.findMany({
          where: { ownerId: user.id, kind: 'PORTFOLIO', path: { in: paths } },
        }),
      ]);
      if (districts.length !== ids.length || !category)
        throw new UserError('พื้นที่หรือประเภทช่างไม่ถูกต้อง');
      if (images.length !== paths.length || paths.some((path) => !validImagePath(path, user.id)))
        throw new UserError('รูปใบสมัครไม่ถูกต้องหรือไม่ใช่รูปที่คุณอัปโหลด');
      // The server owns identity, role and activation; applicant input cannot grant privileges.
      const data = {
        ...profile,
        initials: Array.from(profile.name).slice(0, 2).join(''),
        district: districts[0].name,
        userId: user.id,
        active: false,
        applicationStatus: 'PENDING' as const,
        applicationSubmittedAt: new Date(),
        applicationReviewedAt: null,
        applicationReviewNote: '',
        portfolioPaths: paths,
        workDays: [...new Set(workDays)],
        availableTimes: [...new Set(availableTimes)],
      };
      const technician = user.technician
        ? await tx.technician.update({ where: { id: user.technician.id }, data })
        : await tx.technician.create({ data });
      await tx.technicianDistrict.deleteMany({ where: { technicianId: technician.id } });
      await tx.technicianDistrict.createMany({
        data: ids.map((districtId) => ({ technicianId: technician.id, districtId })),
      });
      await tx.appUser.update({ where: { id: user.id }, data: { name: profile.name, phone } });
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'APPLY_TECHNICIAN', targetId: technician.id },
      });
      return technician.id;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
  );
}

export async function approveTechnicianApplication(tx: Prisma.TransactionClient, id: string) {
  const technician = await tx.technician.findUnique({
    where: { id },
    include: { user: true, categoryModel: true, areas: true },
  });
  if (
    !technician ||
    technician.active ||
    technician.applicationStatus !== 'PENDING' ||
    !technician.user?.active ||
    technician.user.role !== 'CUSTOMER'
  )
    throw new UserError('ไม่พบใบสมัครที่รออนุมัติ');
  const imageCount = await tx.userImage.count({
    where: {
      ownerId: technician.user.id,
      kind: 'PORTFOLIO',
      path: { in: technician.portfolioPaths },
    },
  });
  if (!technician.portfolioPaths.length || imageCount !== technician.portfolioPaths.length)
    throw new UserError('ให้ผู้สมัครแนบรูปประกอบใบสมัครให้ครบก่อนอนุมัติ');
  if (
    !technician.categoryModel.active ||
    !technician.areas.length ||
    !technician.workDays.length ||
    !technician.availableTimes.length
  )
    throw new UserError('กรุณาตรวจประเภทช่าง พื้นที่ และตารางเวลาก่อนอนุมัติ');
  await tx.appUser.update({ where: { id: technician.user.id }, data: { role: 'TECHNICIAN' } });
  await tx.technician.update({
    where: { id },
    data: {
      active: true,
      applicationStatus: 'APPROVED',
      applicationReviewedAt: new Date(),
      applicationReviewNote: '',
    },
  });
}

export async function rejectTechnicianApplication(
  tx: Prisma.TransactionClient,
  id: string,
  note: string,
) {
  if (note.trim().length < 5 || note.length > 500)
    throw new UserError('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร และไม่เกิน 500 ตัวอักษร');
  const application = await tx.technician.findUnique({ where: { id }, include: { user: true } });
  if (
    !application ||
    application.applicationStatus !== 'PENDING' ||
    application.user?.role !== 'CUSTOMER'
  )
    throw new UserError('ไม่พบใบสมัครที่รอตรวจสอบ');
  await tx.technician.update({
    where: { id },
    data: {
      active: false,
      applicationStatus: 'REJECTED',
      applicationReviewedAt: new Date(),
      applicationReviewNote: note.trim(),
    },
  });
}
