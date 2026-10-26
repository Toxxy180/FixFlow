import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { imageBucket, type ImageKind } from '@/lib/images';
import { validImagePath } from '@/lib/images';
import { isPublicTechnician } from '@/lib/technician-visibility';
import { createPublicClient } from '@/lib/supabase/public';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 100) return new Response('Not found', { status: 404 });
  const image = await prisma.userImage.findUnique({ where: { id } });
  if (!image || !validImagePath(image.path, image.ownerId))
    return new Response('Not found', { status: 404 });
  let published = false;
  if (image.kind === 'PORTFOLIO') {
    const technician = await prisma.technician.findUnique({
      where: { userId: image.ownerId },
      include: {
        categoryModel: { select: { active: true } },
        user: { select: { active: true, suspendedUntil: true, role: true } },
      },
    });
    published = Boolean(
      technician &&
      isPublicTechnician(technician) &&
      technician.portfolioPaths.includes(image.path),
    );
  }
  if (!published) {
    const user = await getCurrentUser();
    if (!user) return new Response('Unauthorized', { status: 401 });
    if (image.ownerId !== user.id && user.role !== 'ADMIN')
      return new Response('Not found', { status: 404 });
  }
  try {
    const client = published ? createPublicClient() : await createClient();
    const { data, error } = await client.storage
      .from(imageBucket(image.kind as ImageKind))
      .createSignedUrl(image.path, 60);
    if (error || !data?.signedUrl) return new Response('Image unavailable', { status: 503 });
    return new Response(null, {
      status: 302,
      headers: { Location: data.signedUrl, 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return new Response('Image unavailable', { status: 503 });
  }
}
