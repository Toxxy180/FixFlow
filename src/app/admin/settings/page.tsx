import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { prisma } from '@/lib/prisma';
import { saveSettings } from '@/app/admin/actions';
import { ActionForm } from '@/components/action-form';
export default async function AdminSettings() {
  await requireRole('ADMIN', '/admin/settings');
  const [setting, audit] = await Promise.all([
    getSettings(),
    prisma.auditLog.findMany({
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);
  return (
    <>
      <h1 className="page-title">ตั้งค่าระบบ</h1>
      <p className="mt-2 text-sm text-muted">ชื่อเว็บ ช่องทางติดต่อ และเงื่อนไขการจอง</p>
      <div className="panel mt-6 max-w-3xl">
        <ActionForm action={saveSettings} label="บันทึกการตั้งค่า">
          <div>
            <label className="label" htmlFor="siteName">
              ชื่อเว็บ
            </label>
            <input
              id="siteName"
              name="siteName"
              className="input"
              required
              minLength={2}
              maxLength={40}
              defaultValue={setting.siteName}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div>
              <label className="label" htmlFor="contactEmail">
                อีเมลติดต่อ
              </label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                className="input"
                defaultValue={setting.contactEmail}
              />
            </div>
            <div>
              <label className="label" htmlFor="contactPhone">
                เบอร์โทรติดต่อ
              </label>
              <input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                className="input"
                pattern="0[0-9]{9}|^$"
                maxLength={10}
                defaultValue={setting.contactPhone}
              />
            </div>
            <div>
              <label className="label" htmlFor="maxAdvanceDays">
                จองล่วงหน้าได้สูงสุด (วัน)
              </label>
              <input
                id="maxAdvanceDays"
                name="maxAdvanceDays"
                type="number"
                className="input"
                required
                min={1}
                max={90}
                defaultValue={setting.maxAdvanceDays}
              />
            </div>
            <div>
              <label className="label" htmlFor="cancelBeforeHours">
                ยกเลิกก่อนนัดอย่างน้อย (ชั่วโมง)
              </label>
              <input
                id="cancelBeforeHours"
                name="cancelBeforeHours"
                type="number"
                className="input"
                required
                min={0}
                max={72}
                defaultValue={setting.cancelBeforeHours}
              />
            </div>
            <div>
              <label className="label" htmlFor="travelFee">
                ค่าเดินทาง (บาท)
              </label>
              <input
                id="travelFee"
                name="travelFee"
                type="number"
                className="input"
                required
                min={0}
                max={10000}
                step={1}
                defaultValue={setting.travelFee}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="bookingEnabled" type="checkbox" defaultChecked={setting.bookingEnabled} />
            เปิดรับการจองใหม่
          </label>
        </ActionForm>
        <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          ราคาและค่าเดินทางที่แก้ไขจะใช้กับงานใหม่ ประวัติงานเดิมคงยอดที่บันทึกไว้
          <br />
          การส่ง OTP ตั้งค่าที่ Supabase Auth ส่วนฐานข้อมูลและ hosting ตั้งค่าในบริการที่ deploy
        </p>
      </div>
      <section className="panel mt-6">
        <h2 className="section-title">ประวัติการจัดการล่าสุด</h2>
        <div className="mt-4 divide-y divide-line">
          {audit.length ? (
            audit.map((a) => (
              <div key={a.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>
                  {a.actor.name} · {a.action}
                </span>
                <time className="text-xs text-muted">
                  {new Intl.DateTimeFormat('th-TH', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'Asia/Bangkok',
                  }).format(a.createdAt)}
                </time>
              </div>
            ))
          ) : (
            <p className="py-5 text-sm text-muted">ยังไม่มีประวัติการแก้ไข</p>
          )}
        </div>
      </section>
    </>
  );
}
