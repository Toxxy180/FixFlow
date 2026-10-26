'use client';
import Image from 'next/image';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, UserRound, X } from 'lucide-react';
import { MAX_IMAGE_BYTES } from '@/lib/images';
import type { UploadedImage } from './image-uploader';

export function AccountProfileForm({
  name,
  phone,
  image,
}: {
  name: string;
  phone: string;
  image: UploadedImage | null;
}) {
  const [saved, setSaved] = useState({ name, phone, image });
  const [draftName, setDraftName] = useState(name);
  const [draftPhone, setDraftPhone] = useState(phone);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const router = useRouter();
  const dirty = Boolean(file || remove || draftName !== saved.name || draftPhone !== saved.phone);
  const displayedUrl = file ? preview : remove ? '' : saved.image?.url;
  useEffect(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function clearImageDraft() {
    setFile(null);
    setRemove(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || busy || !ready) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.set('name', draftName);
      form.set('phone', draftPhone);
      form.set('avatarAction', file ? 'REPLACE' : remove ? 'REMOVE' : 'KEEP');
      if (file) form.set('file', file);
      const response = await fetch('/api/account', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
      setSaved({ ...result.profile, image: result.image });
      setDraftName(result.profile.name);
      setDraftPhone(result.profile.phone);
      clearImageDraft();
      setMessage('บันทึกข้อมูลบัญชีแล้ว');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="panel mt-6">
      <fieldset disabled={busy || !ready} className="min-w-0 space-y-4">
        <h2 className="text-sm font-semibold">ข้อมูลส่วนตัว</h2>
        <p className="text-xs leading-relaxed text-muted">
          รูป ชื่อ และเบอร์โทรจะเปลี่ยนพร้อมกันเมื่อกดบันทึกข้อมูล · JPG, PNG, WebP ไม่เกิน 2 MB
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
          {file || (saved.image && !remove) ? (
            <button
              type="button"
              aria-label={file ? 'ยกเลิกรูปที่เลือก' : 'นำรูปโปรไฟล์ออก'}
              className="absolute right-0 top-0 rounded-full border border-line bg-white p-1 shadow"
              onClick={() => {
                setError('');
                setMessage('');
                if (file) clearImageDraft();
                else setRemove(true);
              }}
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
        <div>
          <label htmlFor={`${id}-image`} className="label">
            เลือกรูปโปรไฟล์
          </label>
          <input
            ref={inputRef}
            id={`${id}-image`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
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
                event.currentTarget.value = '';
                setError('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB');
                return;
              }
              setRemove(false);
              setFile(chosen);
            }}
          />
        </div>
        {file || remove ? (
          <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            {remove
              ? 'รูปจะถูกลบเมื่อกดบันทึกข้อมูล'
              : 'ภาพตัวอย่างเท่านั้น ยังไม่ได้บันทึกรูปโปรไฟล์'}
          </p>
        ) : null}
        <div>
          <label htmlFor={`${id}-name`} className="label">
            ชื่อ-นามสกุล
          </label>
          <input
            id={`${id}-name`}
            name="name"
            className="input"
            required
            minLength={2}
            maxLength={100}
            value={draftName}
            onChange={(event) => {
              setDraftName(event.target.value);
              setMessage('');
            }}
          />
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className="label">
            เบอร์โทรศัพท์
          </label>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            className="input"
            pattern="0[0-9]{9}|^$"
            maxLength={10}
            value={draftPhone}
            onChange={(event) => {
              setDraftPhone(event.target.value);
              setMessage('');
            }}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={!dirty || busy || !ready} className="btn text-sm">
            {busy ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              'บันทึกข้อมูล'
            )}
          </button>
          <button
            type="button"
            disabled={!dirty || busy || !ready}
            className="rounded-lg border border-line px-4 py-3 text-sm disabled:opacity-50"
            onClick={() => {
              clearImageDraft();
              setDraftName(saved.name);
              setDraftPhone(saved.phone);
              setError('');
              setMessage('ยกเลิกการแก้ไขแล้ว ข้อมูลยังเป็นค่าเดิม');
            }}
          >
            ยกเลิก
          </button>
        </div>
      </fieldset>
      {message ? (
        <p role="status" className="mt-4 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
