import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { validImagePath } from './images';
import { UserError } from './validation';

export const accountProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9}$|^$/),
});
export type AvatarChange = { action: 'KEEP' | 'REMOVE' } | { action: 'REPLACE'; path: string };

export async function saveAccountProfile(
  tx: Prisma.TransactionClient,
  ownerId: string,
  input: unknown,
  avatar: AvatarChange,
) {
  const parsed = accountProfileSchema.safeParse(input);
  if (!parsed.success) throw new UserError('กรุณากรอกชื่อและเบอร์โทรให้ถูกต้อง');
  if (avatar.action === 'REPLACE' && !validImagePath(avatar.path, ownerId))
    throw new UserError('รูปโปรไฟล์ไม่ถูกต้อง');
  const user = await tx.appUser.findUnique({ where: { id: ownerId } });
  if (!user?.active) throw new UserError('บัญชีนี้ไม่พร้อมใช้งาน');
  const obsoletePaths: string[] = [];
  if (avatar.action !== 'KEEP') {
    const previous = await tx.userImage.findMany({ where: { ownerId, kind: 'AVATAR' } });
    obsoletePaths.push(...previous.map((image) => image.path));
    if (
      user.avatarPath &&
      validImagePath(user.avatarPath, ownerId) &&
      !obsoletePaths.includes(user.avatarPath)
    )
      obsoletePaths.push(user.avatarPath);
    await tx.userImage.deleteMany({ where: { ownerId, kind: 'AVATAR' } });
    if (avatar.action === 'REPLACE')
      await tx.userImage.create({ data: { ownerId, kind: 'AVATAR', path: avatar.path } });
  }
  const updated = await tx.appUser.update({
    where: { id: ownerId },
    data: {
      ...parsed.data,
      ...(avatar.action === 'REMOVE'
        ? { avatarPath: null }
        : avatar.action === 'REPLACE'
          ? { avatarPath: avatar.path }
          : {}),
    },
  });
  const image = updated.avatarPath
    ? await tx.userImage.findFirst({
        where: { ownerId, kind: 'AVATAR', path: updated.avatarPath },
        select: { id: true, path: true },
      })
    : null;
  return {
    profile: { name: updated.name, phone: updated.phone },
    image: image ? { ...image, url: `/api/images/${image.id}` } : null,
    obsoletePaths,
  };
}
