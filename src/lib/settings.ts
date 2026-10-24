import { cache } from 'react';
import { prisma } from './prisma';
export const getSettings = cache(async () => {
  const setting = await prisma.appSetting.findUnique({ where: { id: 'main' } });
  if (!setting) throw new Error('กรุณารัน npm run db:setup ก่อน');
  return setting;
});
