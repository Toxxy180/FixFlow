'use client';
import Image from 'next/image';
import { useEffect, useId, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { MAX_IMAGE_BYTES, MAX_PORTFOLIO_IMAGES } from '@/lib/images';
import type { UploadedImage } from './image-uploader';

export type PortfolioSelection =
  { kind: 'saved'; image: UploadedImage } | { kind: 'file'; id: string; file: File };

function PortfolioPreview({ item, index }: { item: PortfolioSelection; index: number }) {
  const [preview, setPreview] = useState('');
  const file = item.kind === 'file' ? item.file : null;
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const url = item.kind === 'saved' ? item.image.url : preview;
  return url ? (
    <Image
      unoptimized
      src={url}
      fill
      sizes="(max-width: 640px) 45vw, 180px"
      alt={`รูปผลงาน ${index + 1}${file ? ' ที่ยังไม่บันทึก' : ''}`}
      className="object-cover"
    />
  ) : (
    <div className="flex h-32 items-center justify-center bg-soft text-muted">
      <ImagePlus size={30} />
    </div>
  );
}

export function PortfolioEditor({
  images,
  savedImages,
  onChange,
}: {
  images: PortfolioSelection[];
  savedImages: UploadedImage[];
  onChange: (images: PortfolioSelection[]) => void;
}) {
  const id = useId();
  const [error, setError] = useState('');
  const dirty =
    images.length !== savedImages.length ||
    images.some((item, index) => item.kind === 'file' || item.image.id !== savedImages[index]?.id);

  function choose(files: File[], replace?: number) {
    setError('');
    if (!files.length) return;
    if (
      files.some(
        (file) =>
          file.size > MAX_IMAGE_BYTES ||
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      )
    ) {
      setError('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB ต่อรูป');
      return;
    }
    if (replace === undefined && images.length + files.length > MAX_PORTFOLIO_IMAGES) {
      setError('แนบรูปผลงานได้สูงสุด 5 รูป');
      return;
    }
    const additions: PortfolioSelection[] = files.map((file) => ({
      kind: 'file',
      id: crypto.randomUUID(),
      file,
    }));
    onChange(
      replace === undefined
        ? [...images, ...additions]
        : images.map((image, index) => (index === replace ? additions[0] : image)),
    );
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-line p-4"
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`} className="text-sm font-semibold">
        รูปผลงาน ({images.length}/{MAX_PORTFOLIO_IMAGES} รูป)
      </h2>
      <p className="text-xs leading-relaxed text-muted">
        เพิ่ม ลบ หรือเปลี่ยนรูป แล้วกดบันทึกข้อมูลรับงานเพื่อใช้รูปชุดใหม่ · JPG, PNG, WebP ไม่เกิน
        2 MB ต่อรูป
      </p>
      <p className="text-xs text-muted">
        รูปที่บันทึกแล้วจะแสดงให้ผู้เข้าชมดูได้ เมื่อโปรไฟล์ช่างเปิดรับงาน
      </p>
      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-2">
        {images.map((item, index) => (
          <div
            key={item.kind === 'saved' ? item.image.id : item.id}
            className="relative overflow-hidden rounded-xl border border-line"
          >
            <div className="relative h-32">
              <PortfolioPreview item={item} index={index} />
            </div>
            <button
              type="button"
              aria-label={`นำรูปผลงาน ${index + 1} ออก`}
              className="absolute right-1 top-1 rounded-full bg-white p-1 shadow"
              onClick={() => {
                setError('');
                onChange(images.filter((_, position) => position !== index));
              }}
            >
              <X size={16} />
            </button>
            <label
              className="block cursor-pointer bg-soft px-2 py-2 text-center text-xs font-semibold text-primary"
              htmlFor={`${id}-replace-${index}`}
            >
              เปลี่ยนรูป {index + 1}
            </label>
            <input
              id={`${id}-replace-${index}`}
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                choose(Array.from(event.currentTarget.files || []), index);
                event.currentTarget.value = '';
              }}
            />
          </div>
        ))}
      </div>
      {!images.length ? (
        <p className="rounded-lg bg-soft p-4 text-sm text-muted">
          ยังไม่มีรูปผลงาน เลือกรูปเพื่อเพิ่มได้เลย
        </p>
      ) : null}
      <label
        htmlFor={`${id}-add`}
        className="flex items-center gap-2 text-sm font-semibold text-primary"
      >
        <Upload size={17} />
        เพิ่มรูปผลงาน
      </label>
      <input
        id={`${id}-add`}
        type="file"
        className="input text-sm"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={images.length >= MAX_PORTFOLIO_IMAGES}
        onChange={(event) => {
          choose(Array.from(event.currentTarget.files || []));
          event.currentTarget.value = '';
        }}
      />
      {dirty ? (
        <div className="space-y-2">
          <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            รูปยังไม่เปลี่ยนจนกว่าจะกดบันทึกข้อมูลรับงาน
          </p>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              setError('');
              onChange(savedImages.map((image) => ({ kind: 'saved', image })));
            }}
          >
            ยกเลิกการแก้ไขรูป
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
