import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { imageBucket, type ImageKind } from '@/lib/images';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  const image = await prisma.userImage.findUnique({ where: { id } });
  if (!image || (image.ownerId !== user.id && user.role !== 'ADMIN'))
    return new Response('Not found', { status: 404 });
  const client = await createClient();
  const { data, error } = await client.storage
    .from(imageBucket(image.kind as ImageKind))
    .createSignedUrl(image.path, 300);
  if (error || !data?.signedUrl) return new Response('Image unavailable', { status: 503 });
  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, 'Cache-Control': 'private, no-store' },
  });
}
