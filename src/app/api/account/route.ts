import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { prepareImage } from '@/lib/image-processing';
import { imageBucket } from '@/lib/images';
import { imageUploadAllowed } from '@/lib/image-upload-limit';
import { sameOrigin, limitedImageForm } from '@/lib/upload-request';
import { accountProfileSchema, saveAccountProfile, type AvatarChange } from '@/lib/account-profile';
import { UserError } from '@/lib/validation';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'กรุณาเข้าสู่ระบบก่อนบันทึก' }, { status: 401 });
  let uploadedPath = '';
  const bucket = imageBucket('AVATAR');
  let client: Awaited<ReturnType<typeof createClient>> | undefined;
  try {
    const form = await limitedImageForm(request);
    const profile = accountProfileSchema.safeParse(Object.fromEntries(form));
    if (!profile.success) throw new UserError('กรุณากรอกชื่อและเบอร์โทรให้ถูกต้อง');
    const action = form.get('avatarAction') || 'KEEP';
    if (!['KEEP', 'REMOVE', 'REPLACE'].includes(String(action)))
      throw new UserError('ข้อมูลรูปโปรไฟล์ไม่ถูกต้อง');
    let avatar: AvatarChange = { action: action as 'KEEP' | 'REMOVE' };
    if (action === 'REPLACE') {
      const file = form.get('file');
      if (!(file instanceof File)) throw new UserError('กรุณาเลือกรูปโปรไฟล์');
      if (!(await imageUploadAllowed(user.id)))
        return Response.json({ error: 'อัปโหลดบ่อยเกินไป กรุณาลองใหม่ภายหลัง' }, { status: 429 });
      const image = await prepareImage(file, 'AVATAR');
      client = await createClient();
      const path = `${user.id}/${randomUUID()}.webp`;
      const { error } = await client.storage
        .from(bucket)
        .upload(path, image, { contentType: 'image/webp', upsert: false, cacheControl: '3600' });
      if (error) throw new UserError('อัปโหลดรูปไม่สำเร็จ ข้อมูลยังไม่ถูกบันทึก กรุณาลองใหม่');
      uploadedPath = path;
      avatar = { action: 'REPLACE', path };
    }
    const result = await prisma.$transaction(
      (tx) => saveAccountProfile(tx, user.id, profile.data, avatar),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
    );
    uploadedPath = '';
    if (result.obsoletePaths.length) {
      try {
        client ??= await createClient();
        const { error } = await client.storage.from(bucket).remove(result.obsoletePaths);
        if (error) console.warn('Previous avatar cleanup unavailable');
      } catch {
        console.warn('Previous avatar cleanup unavailable');
      }
    }
    revalidatePath('/', 'layout');
    return Response.json({ profile: result.profile, image: result.image });
  } catch (error) {
    if (uploadedPath && client) {
      try {
        await client.storage.from(bucket).remove([uploadedPath]);
      } catch {
        console.warn('Avatar upload cleanup unavailable');
      }
    }
    return Response.json(
      { error: error instanceof UserError ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่' },
      { status: 400 },
    );
  }
}
