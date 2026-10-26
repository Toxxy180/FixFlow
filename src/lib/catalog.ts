import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';
import { loadPublicCatalog } from './catalog-query';

export const getPublicCatalog = unstable_cache(
  () => loadPublicCatalog(prisma),
  ['public-catalog-v1'],
  {
    revalidate: 30,
    tags: ['public-catalog'],
  },
);
