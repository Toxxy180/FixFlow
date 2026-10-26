'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  LayoutGrid,
  Snowflake,
  Zap,
  Droplets,
  Wrench,
  Search,
  MapPin,
  ArrowDown,
  Star,
} from 'lucide-react';
import { currency } from '@/lib/constants';
import { BookingDialog } from './booking-dialog';
import { UserAvatar } from './user-avatar';
import type { PublicTechnician, PublicService, PublicUser } from '@/lib/types';
const icons = {
  ALL: LayoutGrid,
  AIRCON: Snowflake,
  ELECTRIC: Zap,
  PLUMBING: Droplets,
  GENERAL: Wrench,
};
const steps = [
  ['เลือกบริการ', 'ค้นหาบริการที่คุณต้องการ'],
  ['เลือกช่างและเวลา', 'เลือกช่างที่ใช่และนัดเวลาที่สะดวก'],
  ['ยืนยันการจอง', 'ตรวจสอบข้อมูลและยืนยันการจอง'],
];
export function TechnicianExplorer({
  technicians,
  services,
  categories,
  districts,
  today,
  user,
  settings,
}: {
  technicians: PublicTechnician[];
  services: PublicService[];
  categories: { id: string; name: string }[];
  districts: { id: string; name: string }[];
  today: string;
  user: PublicUser | null;
  settings: { travelFee: number; maxAdvanceDays: number; bookingEnabled: boolean };
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [sort, setSort] = useState('default');
  const [selected, setSelected] = useState<PublicTechnician | null>(null);
  const filtered = technicians
    .filter(
      (t) =>
        (category === 'ALL' || t.category === category) &&
        (!district || t.districtIds.includes(district)) &&
        `${t.name} ${t.description} ${t.categoryName} ${t.district}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'low'
        ? a.price - b.price
        : sort === 'high'
          ? b.price - a.price
          : sort === 'rating'
            ? (b.rating || 0) - (a.rating || 0)
            : 0,
    );
  return (
    <>
      <section
        className="grid grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-8 pt-8 max-lg:grid-cols-1"
        aria-label="ค้นหาบริการ"
      >
        <div>
          <h1 className="text-[64px] font-bold leading-[1.16] tracking-[-2px] max-xl:text-[56px] max-sm:text-[40px] max-sm:tracking-[-1px]">
            เรื่องซ่อมบ้าน
            <br />
            <span className="text-primary">ให้เราช่วยดูแล</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted max-sm:text-base">
            เลือกช่างที่ใช่ นัดเวลาที่สะดวก แล้วให้ช่างช่วยจัดการ
          </p>
          <p className="mt-2 text-sm text-muted">บริการในกรุงเทพมหานคร ครบ 50 เขต</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query.trim());
            }}
            className="mt-6 flex items-center gap-2 rounded-xl border border-line p-3 max-sm:flex-wrap"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 px-2 max-sm:basis-full max-sm:py-2">
              <Search size={22} className="shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
                placeholder="ค้นหาช่างหรือบริการ"
                aria-label="ค้นหาช่างหรือบริการ"
                className="min-w-0 w-full bg-transparent py-3 text-sm outline-none"
              />
            </div>
            <div className="flex items-center gap-2 border-l border-line pl-4 max-sm:flex-1 max-sm:border-l-0 max-sm:pl-2">
              <MapPin size={20} className="shrink-0" />
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                aria-label="พื้นที่ให้บริการ"
                className="max-w-40 bg-white py-3 pr-2 text-sm"
              >
                <option value="">ทุกเขตในกรุงเทพฯ</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn min-h-14 shrink-0 px-6" type="submit">
              ค้นหาช่าง
            </button>
          </form>
        </div>
        <aside className="rounded-2xl bg-soft px-8 py-7 max-lg:hidden">
          <h2 className="text-xl font-bold">จองช่างง่ายๆ ใน 3 ขั้นตอน</h2>
          <ol className="mt-5 space-y-5">
            {steps.map(([title, description], i) => (
              <li key={title} className="relative flex gap-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-primary">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
                </div>
                {i < 2 ? (
                  <ArrowDown size={15} className="absolute -bottom-4 left-[17px] text-blue-300" />
                ) : null}
              </li>
            ))}
          </ol>
        </aside>
      </section>
      <div
        className="service-tabs mt-7 flex gap-2.5 overflow-x-auto pb-5"
        aria-label="ประเภทบริการ"
      >
        {[{ id: 'ALL', name: 'ทั้งหมด' }, ...categories].map((c) => {
          const Icon = icons[c.id as keyof typeof icons] || Wrench;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={`flex min-h-[52px] shrink-0 items-center justify-center gap-3 rounded-lg border px-7 text-sm transition-colors max-sm:px-4 ${category === c.id ? 'border-blue-100 bg-soft font-semibold text-primary' : 'border-line bg-white hover:border-blue-300'}`}
            >
              <Icon size={23} strokeWidth={1.8} />
              {c.name}
            </button>
          );
        })}
      </div>
      <section className="border-t border-line pb-10 pt-6" aria-labelledby="results-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="results-title" className="text-[30px] font-bold max-sm:text-2xl">
              ช่างพร้อมดูแลบ้านคุณ
            </h2>
            <p className="mt-1 text-sm text-muted">
              ช่างที่พร้อมดูแลมี {filtered.length} คน
            </p>
          </div>
          <label className="flex items-center gap-3 text-xs text-muted">
            เรียงตาม
            <select
              aria-label="เรียงลำดับช่าง"
              className="rounded-lg border border-line bg-white p-2 text-sm text-ink"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="default">แนะนำ</option>
              <option value="low">ราคาน้อยไปมาก</option>
              <option value="high">ราคามากไปน้อย</option>
              <option value="rating">คะแนนรีวิว</option>
            </select>
          </label>
        </div>
        {!settings.bookingEnabled ? (
          <p role="status" className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            ระบบพักรับการจองชั่วคราว คุณยังดูข้อมูลบริการได้
          </p>
        ) : null}
        <div aria-live="polite">
          {filtered.length ? (
            <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
              {filtered.map((t) => (
                <article
                  key={t.id}
                  className="flex items-center gap-5 rounded-xl border border-line px-5 py-5 max-sm:flex-wrap max-sm:gap-3"
                >
                  {t.avatarPath ? (
                    <UserAvatar
                      path={t.avatarPath}
                      name={t.name}
                      className="h-[74px] w-[74px] max-sm:h-14 max-sm:w-14"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className={`avatar-${t.color} flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-full text-xl font-bold max-sm:h-14 max-sm:w-14`}
                    >
                      {t.initials}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold">{t.name}</h3>
                    <p className="mt-0.5 text-sm text-muted">
                      {t.categoryName}
                      <span className="mx-2 text-slate-300">|</span>
                      {t.district}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.description}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                      {t.rating ? (
                        <>
                          <Star size={13} className="fill-amber-400 text-amber-400" />
                          {t.rating.toFixed(1)} ({t.reviewCount} รีวิว)
                        </>
                      ) : (
                        'ยังไม่มีรีวิว'
                      )}
                      <span className="mx-1">·</span>ประสบการณ์ {t.experience} ปี
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-2 border-l border-line pl-5 max-sm:w-full max-sm:flex-row max-sm:justify-between max-sm:border-l-0 max-sm:border-t max-sm:pl-0 max-sm:pt-3">
                    <p className="whitespace-nowrap text-xs text-muted">
                      เริ่มต้น{' '}
                      <strong className="ml-1 text-lg text-ink">฿{currency(t.price)}</strong>
                    </p>
                    <Link
                      href={`/technicians/${t.id}`}
                      className="text-sm font-semibold text-primary hover:underline"
                      aria-label={`ดูรายละเอียด${t.name}`}
                    >
                      ดูรายละเอียด
                    </Link>
                    {user && user.role !== 'CUSTOMER' ? null : !settings.bookingEnabled ? (
                      <span className="text-sm text-muted">พักรับการจอง</span>
                    ) : !user ? (
                      <Link
                        className="btn min-h-10 min-w-[112px] text-sm"
                        href="/login?next=%2F"
                        aria-label={`เข้าสู่ระบบเพื่อจอง${t.name}`}
                      >
                        จองช่าง
                      </Link>
                    ) : (
                      <button
                        className="btn min-h-10 min-w-[112px] text-sm"
                        onClick={() => setSelected(t)}
                        disabled={!ready}
                        aria-label={`จอง${t.name}`}
                      >
                        จองช่าง
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line py-16 text-center">
              <Search className="mx-auto mb-3 text-slate-400" size={30} />
              <h3 className="font-semibold">ไม่พบช่างที่ตรงกับการค้นหา</h3>
              <p className="mt-2 text-sm text-muted">ลองเปลี่ยนคำค้น ประเภทบริการ หรือเขต</p>
              <button
                onClick={() => {
                  setQuery('');
                  setSearch('');
                  setDistrict('');
                  setCategory('ALL');
                }}
                className="mt-4 text-sm font-semibold text-primary"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          )}
        </div>
      </section>
      {selected && user && user.role === 'CUSTOMER' ? (
        <BookingDialog
          technician={selected}
          services={services.filter((s) => s.categoryId === selected.category)}
          districts={districts.filter((d) => selected.districtIds.includes(d.id))}
          today={today}
          user={user}
          settings={settings}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
