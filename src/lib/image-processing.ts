import sharp from 'sharp';
import { MAX_IMAGE_BYTES, type ImageKind } from './images';
import { UserError } from './validation';

export async function prepareImage(file: File, kind: ImageKind) {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new UserError('รูปต้องมีขนาดไม่เกิน 2 MB');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new UserError('รองรับเฉพาะรูป JPG, PNG และ WebP');
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(buffer, { limitInputPixels: 20000000, animated: false });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || ''))
      throw new Error('Unsupported format');
    // Decode and re-encode: strip EXIF/location metadata and never store executable SVG/HTML.
    return await image
      .rotate()
      .resize(kind === 'AVATAR' ? 512 : 1600, kind === 'AVATAR' ? 512 : 1600, {
        fit: kind === 'AVATAR' ? 'cover' : 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new UserError('อ่านรูปนี้ไม่ได้ กรุณาใช้รูป JPG, PNG หรือ WebP ที่สมบูรณ์');
  }
}
