'use client';
import { useState, useTransition } from 'react';
import { getPaymentQr, payDemo } from '@/app/actions';
import { currency } from '@/lib/constants';
import { MutationButton } from './mutation-button';

export function PromptPayPayment({ id }: { id: string }) {
  const [details, setDetails] = useState<{
    qr: string;
    phone: string;
    name: string;
    amount: number;
  } | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="text-lg font-semibold">ชำระผ่าน PromptPay</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        สแกนจ่ายให้ช่างเจ้าของงานด้วยแอปธนาคาร
      </p>
      {!details ? (
        <button
          type="button"
          className="btn mt-4 w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError('');
              try {
                const result = await getPaymentQr(id);
                if ('error' in result) setError(result.error);
                else setDetails(result);
              } catch {
                setError('โหลด QR ไม่สำเร็จ กรุณาลองใหม่');
              }
            })
          }
        >
          {pending ? 'กำลังสร้าง QR…' : 'แสดง QR สำหรับชำระเงิน'}
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          {/* A server-generated PNG data URL; no third-party QR service receives the phone or amount. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={details.qr}
            width={280}
            height={280}
            alt="QR PromptPay สำหรับชำระให้ช่างเจ้าของงาน"
            className="mx-auto h-auto w-full max-w-[280px]"
          />
          <div className="text-center">
            <p className="text-xl font-bold text-primary">฿{currency(details.amount)}</p>
            <p className="mt-2 break-words text-sm">ช่าง: {details.name}</p>
            <p className="mt-1 font-mono text-sm">PromptPay {details.phone}</p>
          </div>
          <a
            href={details.qr}
            download={`fixflow-payment-${id}.png`}
            className="block text-center text-sm font-semibold text-primary"
          >
            บันทึก QR เพื่อนำเข้าแอปธนาคาร
          </a>
          <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            QR นี้ใช้โอนเงินจริงได้ หากเบอร์ของช่างผูก PromptPay แล้ว
            กรุณาตรวจสอบชื่อผู้รับและยอดเงินในแอปธนาคารก่อนโอน ระบบนี้ไม่ได้ตรวจสอบยอดโอนหรือสลิป
            และปุ่มด้านล่างเป็นการยืนยันสถานะจำลองเท่านั้น
          </p>
          <MutationButton
            action={() => payDemo(id)}
            label="ยืนยันการชำระเงิน (จำลอง)"
            confirm="บันทึกสถานะชำระเงินจำลองและปิดงานนี้? ระบบไม่ได้ตรวจสอบการโอนเงินจริง"
          />
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
