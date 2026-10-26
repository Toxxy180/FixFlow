'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { X, CircleCheck, LoaderCircle } from 'lucide-react';
import { bangkokDate, currency } from '@/lib/constants';
import { createBooking } from '@/app/actions';
import type { PublicTechnician, PublicService, PublicUser } from '@/lib/types';
export function BookingDialog({
  technician,
  services,
  districts,
  today,
  user,
  settings,
  onClose,
}: {
  technician: PublicTechnician;
  services: PublicService[];
  districts: { id: string; name: string }[];
  today: string;
  user: PublicUser;
  settings: { travelFee: number; maxAdvanceDays: number };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [available, setAvailable] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [timeError, setTimeError] = useState('');
  const [time, setTime] = useState('');
  const [retryTimes, setRetryTimes] = useState(0);
  const [pending, start] = useTransition();
  const price = Math.max(services.find((s) => s.id === serviceId)?.price || 0, technician.price);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = old;
    };
  }, []);
  useEffect(() => {
    setAvailable([]);
    setTime('');
    setTimeError('');
    if (!date) {
      setLoadingTimes(false);
      return;
    }
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);
    setLoadingTimes(true);
    fetch(
      `/api/availability?technicianId=${encodeURIComponent(technician.id)}&date=${encodeURIComponent(date)}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const data = await r.json();
        if (controller.signal.aborted) return;
        if (!r.ok || data.error) throw new Error(data.error || 'โหลดช่วงเวลาไม่สำเร็จ');
        setAvailable(data.times);
        if (!data.times.length)
          setTimeError(data.reason || 'วันนี้ไม่มีเวลาว่าง กรุณาเลือกวันอื่น');
      })
      .catch((e) => {
        if (timedOut) setTimeError('โหลดช่วงเวลานานเกินไป กรุณากดโหลดเวลาอีกครั้ง');
        else if (!controller.signal.aborted)
          setTimeError('โหลดช่วงเวลาไม่สำเร็จ กรุณากดโหลดเวลาอีกครั้ง');
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!controller.signal.aborted || timedOut) setLoadingTimes(false);
      });
    return () => {
      clearTimeout(timeout);
      timedOut = false;
      controller.abort();
    };
  }, [date, technician.id, retryTimes]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      aria-labelledby="booking-title"
    >
      <div className="p-7 max-sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="booking-title" className="text-2xl font-bold">
              {reference ? 'จองสำเร็จแล้ว' : `จอง${technician.name}`}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {technician.categoryName} · {technician.district}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            aria-label="ปิดหน้าจอง"
            className="rounded-lg p-2 text-muted hover:bg-slate-100"
          >
            <X size={22} />
          </button>
        </div>
        {reference ? (
          <div className="py-8 text-center">
            <CircleCheck className="mx-auto text-emerald-500" size={56} />
            <h3 className="mt-5 text-lg font-semibold">บันทึกการนัดหมายเรียบร้อย</h3>
            <p className="mt-2 text-sm text-muted">หมายเลขการจอง</p>
            <p className="mt-2 font-mono text-xl font-bold">{reference}</p>
            <p className="mt-4 text-sm text-muted">ติดตามการตอบรับและสถานะงานได้ในรายการจอง</p>
            <Link href="/bookings" onClick={onClose} className="btn mt-7 w-full">
              ดูการจองของฉัน
            </Link>
          </div>
        ) : (
          <>
            <div className="my-5 rounded-xl bg-soft p-4">
              <p className="text-sm">
                ค่าบริการ ฿{currency(price)} + ค่าเดินทาง ฿{currency(settings.travelFee)}
              </p>
              <p className="mt-2 text-xl font-bold text-primary">
                รวมเริ่มต้น ฿{currency(price + settings.travelFee)}
              </p>
              <p className="mt-1 text-xs text-muted">
                ค่าอะไหล่เพิ่มเติมจะแสดงในรายละเอียดงานก่อนชำระเงิน
              </p>
            </div>
            <form
              onInvalid={(e) => {
                const field = e.target as HTMLInputElement;
                const label = field.labels?.[0]?.textContent?.trim() || 'ข้อมูล';
                setError(`กรุณาตรวจสอบ${label}: ${field.validationMessage}`);
              }}
              onSubmit={(e) => {
                e.preventDefault();
                if (pending) return;
                setError('');
                if (!date || !time || !available.includes(time)) {
                  setError(timeError || 'กรุณาเลือกวันและช่วงเวลาที่ว่างก่อนยืนยันการจอง');
                  return;
                }
                const data = new FormData(e.currentTarget);
                start(async () => {
                  try {
                    const result = await createBooking(data);
                    if (result.error) setError(result.error);
                    else if (result.reference) setReference(result.reference);
                  } catch {
                    setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่');
                  }
                });
              }}
              className="space-y-4"
            >
              <input name="technicianId" type="hidden" value={technician.id} />
              <fieldset disabled={pending} className="space-y-4">
                <div>
                  <label className="label" htmlFor="service">
                    บริการ
                  </label>
                  <select
                    id="service"
                    name="serviceId"
                    className="input"
                    required
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · ฿{currency(Math.max(s.price, technician.price))}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                  <div>
                    <label className="label" htmlFor="customer-name">
                      ชื่อ-นามสกุลผู้จอง (จากบัญชี)
                    </label>
                    <input
                      id="customer-name"
                      name="customerName"
                      className="input"
                      value={user.name}
                      readOnly
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="phone">
                      เบอร์โทรศัพท์
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      className="input"
                      defaultValue={user.phone}
                      placeholder="08xxxxxxxx"
                      required
                      pattern="0[0-9]{9}"
                      maxLength={10}
                      autoComplete="tel"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                  <div>
                    <label className="label" htmlFor="date">
                      วันที่นัดหมาย
                    </label>
                    <input
                      id="date"
                      name="date"
                      type="date"
                      min={today}
                      max={bangkokDate(new Date(Date.now() + settings.maxAdvanceDays * 86400000))}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      onInput={(e) => setDate(e.currentTarget.value)}
                      className="input min-w-0"
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="time">
                      เวลานัดหมาย
                    </label>
                    <select
                      id="time"
                      name="time"
                      className="input"
                      required
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      disabled={loadingTimes || !available.length}
                    >
                      <option value="">
                        {loadingTimes
                          ? 'กำลังโหลด...'
                          : !date
                            ? 'เลือกวันที่ก่อน'
                            : available.length
                              ? 'เลือกช่วงเวลา'
                              : 'ไม่มีช่วงเวลาว่าง'}
                      </option>
                      {available.map((t) => (
                        <option key={t} value={t}>
                          {t} น.
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {timeError ? (
                  <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    {timeError}
                    <button
                      type="button"
                      className="ml-3 underline"
                      onClick={() => setRetryTimes((n) => n + 1)}
                    >
                      โหลดเวลาอีกครั้ง
                    </button>
                  </div>
                ) : null}
                <div>
                  <label className="label" htmlFor="district">
                    เขตเข้ารับบริการ
                  </label>
                  <select
                    id="district"
                    name="districtId"
                    className="input"
                    required
                    defaultValue=""
                  >
                    <option value="">เลือกเขตในกรุงเทพมหานคร</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="address">
                    ที่อยู่เข้ารับบริการ
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    className="input resize-y"
                    rows={2}
                    placeholder="บ้านเลขที่ ถนน แขวง และจุดสังเกต"
                    required
                    minLength={10}
                    maxLength={500}
                    autoComplete="street-address"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="details">
                    รายละเอียดงาน <span className="font-normal text-muted">(ไม่บังคับ)</span>
                  </label>
                  <textarea
                    id="details"
                    name="details"
                    className="input resize-y"
                    rows={2}
                    maxLength={1000}
                    placeholder="เช่น แอร์ไม่เย็น 1 เครื่อง"
                  />
                </div>
              </fieldset>
              <p className="text-xs leading-relaxed text-muted">
                ข้อมูลช่างตัวอย่างสำหรับ Mini Project · เวลาอ้างอิงประเทศไทย
              </p>
              {error ? (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <button className="btn w-full" disabled={pending || loadingTimes}>
                {pending ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : loadingTimes ? (
                  'กำลังโหลดช่วงเวลา...'
                ) : (
                  'ยืนยันการจอง'
                )}
              </button>
              <p className="text-xs text-muted" aria-live="polite">
                {!date
                  ? 'เลือกวันที่นัดหมายก่อน ระบบจะแสดงช่วงเวลาที่ช่างว่าง'
                  : !time
                    ? 'เลือกช่วงเวลานัดหมาย แล้วกรอกข้อมูลให้ครบเพื่อยืนยัน'
                    : `เวลาที่เลือก ${time} น. (เวลาประเทศไทย)`}
              </p>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}
