import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';
const loadSettings = unstable_cache(
  async () => {
    const setting = await prisma.appSetting.findUnique({ where: { id: 'main' } });
    if (!setting) throw new Error('กรุณารัน npm run db:setup ก่อน');
    return setting;
  },
  ['public-settings-v1'],
  { revalidate: 30, tags: ['public-catalog'] },
);
export const getSettings = cache(loadSettings);
