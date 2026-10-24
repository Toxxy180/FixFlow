import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { currency } from '@/lib/constants';
import { saveCategory, saveService } from '@/app/admin/actions';
import { ActionForm } from '@/components/action-form';
import { ArchiveButton } from '@/components/archive-button';
export default async function AdminServices() {
  await requireRole('ADMIN', '/admin/services');
  const [categories, services] = await Promise.all([
    prisma.serviceCategory.findMany(),
    prisma.service.findMany({ include: { category: true }, orderBy: { name: 'asc' } }),
  ]);
  const editor = (service?: (typeof services)[number]) => (
    <ActionForm
      action={saveService}
      resetOnSuccess={!service}
      label={service ? 'บันทึกบริการ' : 'เพิ่มบริการ'}
    >
      <input name="id" type="hidden" value={service?.id || ''} />
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <div>
          <label className="label" htmlFor={`${service?.id || 'new'}-name`}>
            ชื่อบริการ
          </label>
          <input
            id={`${service?.id || 'new'}-name`}
            name="name"
            className="input"
            required
            minLength={2}
            maxLength={100}
            defaultValue={service?.name}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${service?.id || 'new'}-category`}>
            หมวดหมู่
          </label>
          <select
            id={`${service?.id || 'new'}-category`}
            name="categoryId"
            className="input"
            defaultValue={service?.categoryId}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${service?.id || 'new'}-price`}>
            ราคาเริ่มต้น (บาท)
          </label>
          <input
            id={`${service?.id || 'new'}-price`}
            name="price"
            type="number"
            className="input"
            required
            min={0}
            max={100000}
            step={1}
            defaultValue={service?.price || 0}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${service?.id || 'new'}-description`}>
          รายละเอียด
        </label>
        <textarea
          id={`${service?.id || 'new'}-description`}
          name="description"
          className="input"
          rows={2}
          maxLength={500}
          defaultValue={service?.description}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={service?.active ?? true} />
        เปิดใช้งานบริการ
      </label>
    </ActionForm>
  );
  return (
    <>
      <h1 className="page-title">บริการและหมวดหมู่</h1>
      <p className="mt-2 text-sm text-muted">ตั้งค่าราคาและบริการที่ลูกค้าเลือกจองได้</p>
      <details className="panel my-6">
        <summary className="cursor-pointer font-semibold text-primary">เพิ่มบริการใหม่</summary>
        <div className="mt-5">{editor()}</div>
      </details>
      <div className="space-y-4">
        {services.map((s) => (
          <details key={`${s.id}-${s.active}`} className="panel">
            <summary className="cursor-pointer">
              <span className="ml-2 inline-flex flex-wrap items-center gap-3">
                <strong>{s.name}</strong>
                <span className="text-sm text-muted">
                  {s.category.name} · ฿{currency(s.price)}
                </span>
                <span
                  className={`rounded-md px-2 py-1 text-xs ${s.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-muted'}`}
                >
                  {s.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </span>
              </span>
            </summary>
            <div className="mt-5">
              {editor(s)}
              {s.active ? (
                <div className="mt-5 border-t border-line pt-4">
                  <ArchiveButton kind="SERVICE" id={s.id} />
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </div>
      <h2 className="mb-4 mt-8 section-title">จัดการหมวดหมู่</h2>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {[...categories, null].map((c) => (
          <section key={c?.id || 'new'} className="panel">
            <h3 className="mb-4 font-semibold">{c?.name || 'เพิ่มหมวดหมู่'}</h3>
            <ActionForm action={saveCategory} resetOnSuccess={!c}>
              <input name="id" type="hidden" value={c?.id || ''} />
              <div>
                <label className="label" htmlFor={`category-${c?.id || 'new'}`}>
                  ชื่อหมวดหมู่
                </label>
                <input
                  id={`category-${c?.id || 'new'}`}
                  name="name"
                  className="input"
                  required
                  minLength={2}
                  maxLength={60}
                  defaultValue={c?.name}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="active" type="checkbox" defaultChecked={c?.active ?? true} />
                เปิดแสดงหมวดหมู่
              </label>
            </ActionForm>
          </section>
        ))}
      </div>
    </>
  );
}
