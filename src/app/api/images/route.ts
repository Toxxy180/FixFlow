import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { prepareImage } from '@/lib/image-processing';
import {
  imageBucket,
  MAX_PORTFOLIO_IMAGES,
  MAX_STAGED_PORTFOLIO_IMAGES,
  type ImageKind,
} from '@/lib/images';
import { UserError } from '@/lib/validation';
import { sameOrigin, limitedImageForm } from '@/lib/upload-request';
import { imageUploadAllowed } from '@/lib/image-upload-limit';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'กรุณาเข้าสู่ระบบก่อนอัปโหลด' }, { status: 401 });
  let uploadedPath = '';
  let bucket = '';
  const client = await createClient();
  try {
    const form = await limitedImageForm(request);
    const kind = form.get('kind') as ImageKind;
    if (!['AVATAR', 'PORTFOLIO'].includes(kind)) throw new UserError('ประเภทของรูปไม่ถูกต้อง');
    if (kind === 'PORTFOLIO' && user.role !== 'TECHNICIAN')
      return Response.json({ error: 'เฉพาะบัญชีช่างเท่านั้น' }, { status: 403 });
    let portfolioLimit = MAX_PORTFOLIO_IMAGES;
    if (kind === 'PORTFOLIO' && form.get('purpose') === 'WORK_PROFILE') {
      const technician = await prisma.technician.findUnique({
        where: { userId: user.id },
        select: { applicationStatus: true },
      });
      if (!technician || !['APPROVED', 'NONE'].includes(technician.applicationStatus))
        throw new UserError('กรุณารอ Admin อนุมัติก่อนแก้ไขรูปผลงาน');
      // Keep the saved set while uploading replacements; at most five are attached on save.
      portfolioLimit = MAX_STAGED_PORTFOLIO_IMAGES;
    }
    const file = form.get('file');
    if (!(file instanceof File)) throw new UserError('กรุณาเลือกไฟล์รูป');
    if (!(await imageUploadAllowed(user.id)))
      return Response.json({ error: 'อัปโหลดบ่อยเกินไป กรุณาลองใหม่ภายหลัง' }, { status: 429 });
    if (
      kind === 'PORTFOLIO' &&
      (await prisma.userImage.count({ where: { ownerId: user.id, kind } })) >= portfolioLimit
    )
      throw new UserError('มีรูปที่อัปโหลดครบจำนวนแล้ว กรุณาบันทึกหรือลบรูปที่ยังไม่ได้ใช้ก่อน');
    const image = await prepareImage(file, kind);
    bucket = imageBucket(kind);
    const path = `${user.id}/${randomUUID()}.webp`;
    const { error } = await client.storage
      .from(bucket)
      .upload(path, image, { contentType: 'image/webp', upsert: false, cacheControl: '3600' });
    if (error) {
      console.error('Image upload rejected', { status: error.name });
      throw new UserError('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่หรือตรวจการตั้งค่า Storage');
    }
    uploadedPath = path;
    const previous =
      kind === 'AVATAR'
        ? await prisma.userImage.findMany({ where: { ownerId: user.id, kind } })
        : [];
    const record = await prisma.$transaction(
      async (tx) => {
        if (
          kind === 'PORTFOLIO' &&
          (await tx.userImage.count({ where: { ownerId: user.id, kind } })) >= portfolioLimit
        )
          throw new UserError('แนบรูปได้สูงสุด 5 รูป');
        const result = await tx.userImage.create({ data: { ownerId: user.id, kind, path } });
        if (kind === 'AVATAR') {
          await tx.appUser.update({ where: { id: user.id }, data: { avatarPath: path } });
          await tx.userImage.deleteMany({
            where: { ownerId: user.id, kind, id: { not: result.id } },
          });
        }
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    uploadedPath = '';
    if (previous.length)
      await client.storage.from(bucket).remove(previous.map((item) => item.path));
    revalidateTag('public-catalog', { expire: 0 });
    revalidatePath('/', 'layout');
    return Response.json({
      image: { id: record.id, path: record.path, url: `/api/images/${record.id}` },
    });
  } catch (error) {
    if (uploadedPath) await client.storage.from(bucket).remove([uploadedPath]);
    return Response.json(
      { error: error instanceof UserError ? error.message : 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่' },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  try {
    const { id } = await request.json();
    if (typeof id !== 'string' || id.length > 100) throw new UserError('รูปไม่ถูกต้อง');
    const image = await prisma.userImage.findFirst({ where: { id, ownerId: user.id } });
    if (!image) return Response.json({ error: 'ไม่พบรูปหรือคุณไม่มีสิทธิ์' }, { status: 404 });
    await prisma.$transaction(
      async (tx) => {
        const technician = await tx.technician.findUnique({ where: { userId: user.id } });
        if (image.kind === 'PORTFOLIO' && technician?.portfolioPaths.includes(image.path)) {
          if (['APPROVED', 'NONE'].includes(technician.applicationStatus))
            throw new UserError('กรุณานำรูปออกในหน้าแก้ไขข้อมูลรับงาน แล้วกดบันทึกข้อมูลรับงาน');
          await tx.technician.update({
            where: { id: technician.id },
            data: {
              portfolioPaths: technician.portfolioPaths.filter((path) => path !== image.path),
            },
          });
        }
        if (image.kind === 'AVATAR')
          await tx.appUser.updateMany({
            where: { id: user.id, avatarPath: image.path },
            data: { avatarPath: null },
          });
        await tx.userImage.delete({ where: { id: image.id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    const client = await createClient();
    await client.storage.from(imageBucket(image.kind as ImageKind)).remove([image.path]);
    revalidateTag('public-catalog', { expire: 0 });
    revalidatePath('/', 'layout');
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof UserError ? error.message : 'ลบรูปไม่สำเร็จ' },
      { status: 400 },
    );
  }
}
