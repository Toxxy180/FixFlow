'use client';
import Image from 'next/image';
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Upload, X } from 'lucide-react';
import { MAX_IMAGE_BYTES, MAX_PORTFOLIO_IMAGES, type ImageKind } from '@/lib/images';
import { AvatarEditor } from './avatar-editor';

export type UploadedImage = { id: string; path: string; url: string };
type ImageUploaderProps = {
  kind: ImageKind;
  initialImages?: UploadedImage[];
  required?: boolean;
};
export function ImageUploader(props: ImageUploaderProps) {
  return props.kind === 'AVATAR' ? (
    <AvatarEditor initialImages={props.initialImages || []} />
  ) : (
    <PortfolioImageUploader {...props} />
  );
}
function PortfolioImageUploader({
  kind,
  initialImages = [],
  required = false,
}: ImageUploaderProps) {
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  const router = useRouter();
  const avatar = kind === 'AVATAR';
  return (
    <div className="space-y-3">
      <p className="label">{avatar ? 'รูปโปรไฟล์' : 'รูปผลงานหรือรูปประกอบใบสมัคร (1–5 รูป)'}</p>
      <p className="text-xs leading-relaxed text-muted">
        {avatar
          ? 'รูปโปรไฟล์จะแสดงบนเว็บ ทุกระดับบัญชีอัปโหลดได้'
          : 'เจ้าของบัญชีและ Admin เท่านั้นที่ดูรูปเหล่านี้ได้'}{' '}
        · JPG, PNG, WebP ไม่เกิน 2 MB ต่อรูป
      </p>
      <div className="flex flex-wrap gap-3">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`relative overflow-hidden border border-line ${avatar ? 'h-24 w-24 rounded-full' : 'h-28 w-28 rounded-xl'}`}
          >
            <Image
              unoptimized
              src={image.url}
              width={112}
              height={112}
              alt={avatar ? 'รูปโปรไฟล์ปัจจุบัน' : `รูปประกอบใบสมัคร ${index + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              aria-label={avatar ? 'ลบรูปโปรไฟล์' : `ลบรูปประกอบใบสมัคร ${index + 1}`}
              disabled={busy}
              className="absolute right-1 top-1 rounded-full bg-white p-1 shadow"
              onClick={async () => {
                if (!window.confirm('ยืนยันลบรูปนี้? หากอยู่ในใบสมัคร รูปจะถูกนำออกทันที')) return;
                setBusy(true);
                setError('');
                try {
                  const response = await fetch('/api/images', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: image.id }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error);
                  setImages((current) => current.filter((item) => item.id !== image.id));
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'ลบรูปไม่สำเร็จ');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {images.map((image) =>
        !avatar ? (
          <input key={image.id} type="hidden" name="portfolioPaths" value={image.path} />
        ) : null,
      )}
      <input type="hidden" name="_imagesPending" value={busy ? 'true' : 'false'} />
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Upload size={17} />
        {avatar ? 'เลือกรูปโปรไฟล์' : 'เพิ่มรูปประกอบใบสมัคร'}
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={!avatar}
        required={required && !images.length}
        disabled={busy || (!avatar && images.length >= MAX_PORTFOLIO_IMAGES)}
        className="input text-sm"
        onChange={async (event) => {
          const input = event.currentTarget;
          const files = Array.from(input.files || []);
          setError('');
          if (!files.length) return;
          if (!avatar && images.length + files.length > MAX_PORTFOLIO_IMAGES) {
            setError('แนบรูปได้สูงสุด 5 รูป');
            input.value = '';
            return;
          }
          if (
            files.some(
              (file) =>
                file.size > MAX_IMAGE_BYTES ||
                !['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
            )
          ) {
            setError('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB ต่อรูป');
            input.value = '';
            return;
          }
          setBusy(true);
          try {
            for (const file of files) {
              const form = new FormData();
              form.set('kind', kind);
              form.set('file', file);
              const response = await fetch('/api/images', { method: 'POST', body: form });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error || 'อัปโหลดไม่สำเร็จ');
              setImages((current) => (avatar ? [data.image] : [...current, data.image]));
            }
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'อัปโหลดไม่สำเร็จ');
          } finally {
            setBusy(false);
            input.value = '';
          }
        }}
      />
      {busy ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle size={16} className="animate-spin" />
          กำลังจัดการรูป กรุณารอให้เสร็จก่อนส่งใบสมัคร
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
