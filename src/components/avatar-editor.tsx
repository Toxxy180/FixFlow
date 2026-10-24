'use client';
import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Upload, UserRound, X } from 'lucide-react';
import { MAX_IMAGE_BYTES } from '@/lib/images';
import type { UploadedImage } from './image-uploader';

export function AvatarEditor({ initialImages }: { initialImages: UploadedImage[] }) {
  const initialImage = initialImages[0] || null;
  const [savedImage, setSavedImage] = useState<UploadedImage | null>(initialImage);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const router = useRouter();
  const dirty = Boolean(file || remove);
  const displayedUrl = file ? previewUrl : remove ? '' : savedImage?.url;

  useEffect(() => {
    setSavedImage(initialImage);
  }, [initialImage?.id, initialImage?.url]);
  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function clearDraft() {
    setFile(null);
    setRemove(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      let response: Response;
      if (file) {
        const form = new FormData();
        form.set('kind', 'AVATAR');
        form.set('file', file);
        response = await fetch('/api/images', { method: 'POST', body: form });
      } else if (remove && savedImage) {
        response = await fetch('/api/images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: savedImage.id }),
        });
      } else return;
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'บันทึกรูปไม่สำเร็จ');
      setSavedImage(file ? result.image : null);
      clearDraft();
      setMessage('บันทึกรูปโปรไฟล์แล้ว');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกรูปไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">รูปโปรไฟล์</h2>
      <p className="text-xs leading-relaxed text-muted">
        เลือกรูปเพื่อดูตัวอย่าง แล้วกดบันทึกรูปเพื่อเปลี่ยนโปรไฟล์ · JPG, PNG, WebP ไม่เกิน 2 MB
      </p>
      <div className="relative h-24 w-24">
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-line bg-soft text-primary">
          {displayedUrl ? (
            <Image
              unoptimized
              src={displayedUrl}
              width={96}
              height={96}
              alt={file ? 'ตัวอย่างรูปโปรไฟล์ที่ยังไม่บันทึก' : 'รูปโปรไฟล์ปัจจุบัน'}
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound size={42} />
          )}
        </div>
        {file || (savedImage && !remove) ? (
          <button
            type="button"
            disabled={busy}
            aria-label={file ? 'ยกเลิกรูปที่เลือก' : 'นำรูปโปรไฟล์ออก'}
            className="absolute right-0 top-0 rounded-full border border-line bg-white p-1 shadow"
            onClick={() => {
              setError('');
              setMessage('');
              if (file) clearDraft();
              else setRemove(true);
            }}
          >
            <X size={15} />
          </button>
        ) : null}
      </div>
      {dirty ? (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          {remove
            ? 'รูปเดิมจะถูกลบเมื่อกดบันทึกรูป กดยกเลิกเพื่อคงรูปเดิม'
            : 'ภาพตัวอย่างเท่านั้น รูปโปรไฟล์ยังไม่เปลี่ยนจนกว่าจะกดบันทึกรูป'}
        </p>
      ) : null}
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Upload size={17} />
        เลือกรูปโปรไฟล์
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        className="input text-sm"
        onChange={(event) => {
          const chosen = event.currentTarget.files?.[0];
          setError('');
          setMessage('');
          if (!chosen) return;
          if (
            chosen.size > MAX_IMAGE_BYTES ||
            !['image/jpeg', 'image/png', 'image/webp'].includes(chosen.type)
          ) {
            clearDraft();
            setError('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB');
            return;
          }
          setRemove(false);
          setFile(chosen);
        }}
      />
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn text-sm">
          {busy ? (
            <>
              <LoaderCircle size={16} className="animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            'บันทึกรูป'
          )}
        </button>
        <button
          type="button"
          disabled={busy || !dirty}
          className="rounded-lg border border-line px-4 py-3 text-sm disabled:opacity-50"
          onClick={() => {
            clearDraft();
            setError('');
            setMessage('ยกเลิกแล้ว รูปโปรไฟล์ยังเป็นรูปเดิม');
          }}
        >
          ยกเลิก
        </button>
      </div>
      {message ? (
        <p role="status" className="text-sm text-emerald-700">
          {message}
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
