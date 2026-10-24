import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { times } from '@/lib/constants';
import { ActionForm } from '@/components/action-form';
import { applyAsTechnician } from './actions';
import { ImageUploader } from '@/components/image-uploader';

export default async function TechnicianApplication() {
  const user = await requireUser('/technician/apply');
  const [existing, categories, districts, images] = await Promise.all([
    prisma.technician.findUnique({ where: { userId: user.id }, include: { areas: true } }),
    prisma.serviceCategory.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.district.findMany({ orderBy: { name: 'asc' } }),
    prisma.userImage.findMany({
      where: { ownerId: user.id, kind: 'PORTFOLIO' },
      select: { id: true, path: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  if (user.role === 'ADMIN') redirect('/admin');
  if (user.role !== 'CUSTOMER' || existing?.applicationStatus === 'APPROVED') redirect('/account');
  return (
    <main className="shell max-w-3xl py-10">
      <Link href="/account" className="text-sm text-primary">
        กลับไปบัญชีของฉัน
      </Link>
      <h1 className="page-title mt-5">สมัครเป็นช่าง</h1>
      <p className="my-5 text-sm text-muted">
        กรอกข้อมูลให้ผู้ดูแลตรวจสอบ เมื่ออนุมัติแล้วโปรไฟล์จะแสดงบนหน้าค้นหา
        ระหว่างรอคุณยังจองบริการได้
      </p>
      {existing?.applicationReviewNote ? (
        <p className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          ข้อเสนอแนะจาก Admin: {existing.applicationReviewNote}
        </p>
      ) : null}
      <div className="panel">
        <ActionForm
          action={applyAsTechnician}
          label={existing ? 'บันทึกและส่งใบสมัครให้ตรวจอีกครั้ง' : 'ส่งใบสมัครให้ Admin ตรวจสอบ'}
        >
          <label className="label" htmlFor="apply-name">
            ชื่อช่างที่แสดง
          </label>
          <input
            className="input"
            id="apply-name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={existing?.name || user.name}
          />
          <label className="label" htmlFor="apply-phone">
            เบอร์โทรศัพท์
          </label>
          <input
            className="input"
            id="apply-phone"
            name="phone"
            type="tel"
            required
            pattern="0[0-9]{9}"
            maxLength={10}
            defaultValue={user.phone}
          />
          <label className="label" htmlFor="apply-category">
            ประเภทช่าง
          </label>
          <select
            className="input"
            id="apply-category"
            name="category"
            required
            defaultValue={existing?.category || ''}
          >
            <option value="">เลือกประเภทช่าง</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="label" htmlFor="apply-description">
            รายละเอียดบริการและประสบการณ์
          </label>
          <textarea
            className="input"
            id="apply-description"
            name="description"
            required
            minLength={5}
            maxLength={500}
            rows={3}
            defaultValue={existing?.description}
          />
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div>
              <label className="label" htmlFor="apply-price">
                ค่าบริการขั้นต่ำ (บาท)
              </label>
              <input
                className="input"
                id="apply-price"
                name="price"
                type="number"
                required
                min={0}
                max={100000}
                step={1}
                defaultValue={existing?.price}
              />
            </div>
            <div>
              <label className="label" htmlFor="apply-experience">
                ประสบการณ์ (ปี)
              </label>
              <input
                className="input"
                id="apply-experience"
                name="experience"
                type="number"
                required
                min={0}
                max={60}
                step={1}
                defaultValue={existing?.experience || 0}
              />
            </div>
          </div>
          <fieldset>
            <legend className="label">วันเปิดรับงาน</legend>
            <div className="flex flex-wrap gap-4">
              {['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'].map(
                (day, i) => (
                  <label className="text-sm" key={day}>
                    <input
                      type="checkbox"
                      name="workDays"
                      value={i}
                      defaultChecked={existing ? existing.workDays.includes(i) : true}
                    />{' '}
                    {day}
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">ช่วงเวลารับงาน</legend>
            <div className="flex flex-wrap gap-4">
              {times.map((time) => (
                <label className="text-sm" key={time}>
                  <input
                    type="checkbox"
                    name="availableTimes"
                    value={time}
                    defaultChecked={existing ? existing.availableTimes.includes(time) : true}
                  />{' '}
                  {time} น.
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">เขตให้บริการในกรุงเทพฯ (เลือกอย่างน้อย 1 เขต)</legend>
            <div className="grid max-h-64 grid-cols-3 gap-3 overflow-y-auto rounded-lg border border-line p-4 max-sm:grid-cols-2">
              {districts.map((d) => (
                <label className="text-sm" key={d.id}>
                  <input
                    type="checkbox"
                    name="districtIds"
                    value={d.id}
                    defaultChecked={existing?.areas.some((area) => area.districtId === d.id)}
                  />{' '}
                  {d.name}
                </label>
              ))}
            </div>
          </fieldset>
          <ImageUploader
            kind="PORTFOLIO"
            required
            initialImages={images.map((image) => ({ ...image, url: `/api/images/${image.id}` }))}
          />
          <label htmlFor="apply-portfolio-url" className="label">
            ลิงก์ผลงานหรือเพจ (ไม่บังคับ)
          </label>
          <input
            id="apply-portfolio-url"
            name="portfolioUrl"
            type="url"
            className="input"
            maxLength={500}
            placeholder="https://..."
            defaultValue={existing?.portfolioUrl}
          />
        </ActionForm>
      </div>
    </main>
  );
}
