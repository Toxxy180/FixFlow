import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { currency } from '@/lib/constants';
import { approveTechnician, rejectTechnician } from '@/app/admin/actions';
import { MutationButton } from '@/components/mutation-button';
import { ActionForm } from '@/components/action-form';
import { UserAvatar } from '@/components/user-avatar';

export default async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('ADMIN', '/admin/technicians');
  const { id } = await params;
  const application = await prisma.technician.findUnique({
    where: { id },
    include: {
      categoryModel: true,
      areas: { include: { district: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          active: true,
          avatarPath: true,
          role: true,
        },
      },
    },
  });
  if (!application) notFound();
  const images = application.userId
    ? await prisma.userImage.findMany({
        where: {
          ownerId: application.userId,
          kind: 'PORTFOLIO',
          path: { in: application.portfolioPaths },
        },
        select: { id: true },
      })
    : [];
  const pending =
    application.applicationStatus === 'PENDING' && application.user?.role === 'TECHNICIAN';
  const status = {
    NONE: 'โปรไฟล์ที่ผู้ดูแลสร้าง',
    PENDING: 'รอ Admin ตรวจสอบ',
    APPROVED: 'อนุมัติแล้ว',
    REJECTED: 'ส่งกลับให้แก้ไข',
  }[application.applicationStatus];
  const dateLabel = (date: Date) =>
    new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Bangkok',
    }).format(date);
  return (
    <>
      <Link href="/admin/technicians" className="text-sm text-primary">
        กลับไปจัดการช่าง
      </Link>
      <div className="my-6 flex items-center gap-4">
        <UserAvatar
          path={application.user?.avatarPath}
          name={application.name}
          className="h-16 w-16"
        />
        <div>
          <h1 className="page-title">รายละเอียดคำขอสมัครช่าง</h1>
          <p className="mt-2 text-sm text-muted">
            {application.name} · {status}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-6 max-xl:grid-cols-1">
        <div className="space-y-6">
          <section className="panel">
            <h2 className="section-title">ข้อมูลผู้สมัครและบริการ</h2>
            <dl className="mt-5 grid grid-cols-2 gap-5 text-sm max-sm:grid-cols-1">
              {[
                ['ชื่อบัญชี', application.user?.name || 'ยังไม่เชื่อมบัญชี'],
                ['อีเมล', application.user?.email || '—'],
                ['เบอร์โทร', application.user?.phone || '—'],
                ['ชื่อช่าง', application.name],
                ['ประเภทงาน', application.categoryModel.name],
                ['ประสบการณ์', `${application.experience} ปี`],
                ['ค่าบริการขั้นต่ำ', `฿${currency(application.price)}`],
                [
                  'วันที่ส่งใบสมัคร',
                  application.applicationSubmittedAt
                    ? dateLabel(application.applicationSubmittedAt)
                    : '—',
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="mt-1 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 whitespace-pre-wrap break-words rounded-lg bg-soft p-4 text-sm">
              {application.description}
            </p>
            {application.portfolioUrl ? (
              <a
                className="mt-4 inline-block break-all text-sm text-primary underline"
                href={application.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                เปิดลิงก์ผลงาน / เพจของผู้สมัคร
              </a>
            ) : null}
          </section>
          <section className="panel">
            <h2 className="section-title">รูปประกอบใบสมัคร ({images.length} รูป)</h2>
            <p className="mt-2 text-xs text-muted">
              รูปส่วนตัวสำหรับเจ้าของและ Admin · กดรูปเพื่อดูขนาดเต็ม
            </p>
            {images.length ? (
              <div className="mt-5 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                {images.map((image, index) => (
                  <a
                    key={image.id}
                    href={`/api/images/${image.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="overflow-hidden rounded-xl border border-line"
                  >
                    <Image
                      unoptimized
                      src={`/api/images/${image.id}`}
                      width={640}
                      height={480}
                      className="aspect-[4/3] w-full object-cover"
                      alt={`รูปผลงานหรือรูปประกอบ ${index + 1}`}
                    />
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                ผู้สมัครยังไม่ได้แนบรูป กรุณาส่งกลับให้เพิ่มรูปก่อนอนุมัติ
              </p>
            )}
          </section>
          <section className="panel">
            <h2 className="section-title">พื้นที่และเวลารับงาน</h2>
            <p className="mt-4 text-sm">
              {application.workDays
                .map(
                  (day) =>
                    ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][day],
                )
                .join(' · ')}
            </p>
            <p className="mt-2 text-sm">เวลา {application.availableTimes.join(' · ')} น.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {application.areas.map((area) => (
                <span key={area.districtId} className="rounded-lg bg-soft px-3 py-2 text-xs">
                  {area.district.name}
                </span>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="panel">
            <h2 className="section-title">ผลการตรวจสอบ</h2>
            <p className="mt-4 text-sm">{status}</p>
            {application.applicationReviewedAt ? (
              <p className="mt-2 text-xs text-muted">
                ตรวจเมื่อ {dateLabel(application.applicationReviewedAt)}
              </p>
            ) : null}
            {application.applicationReviewNote ? (
              <p className="mt-4 whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm">
                {application.applicationReviewNote}
              </p>
            ) : null}
          </section>
          {pending ? (
            <section className="panel space-y-5">
              <h2 className="section-title">พิจารณาคำขอ</h2>
              <p className="text-sm text-muted">ตรวจข้อมูล รูป และตารางเวลาก่อนอนุมัติ</p>
              {images.length ? (
                <MutationButton
                  action={approveTechnician.bind(null, id)}
                  label="อนุมัติและเปิดรับงาน"
                  confirm="ยืนยันอนุมัติผู้สมัครนี้เป็นช่างและเปิดรับงาน?"
                />
              ) : (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  ต้องมีรูปประกอบใบสมัครก่อน จึงจะอนุมัติได้
                </p>
              )}
              <div className="border-t border-line pt-5">
                <ActionForm action={rejectTechnician} label="ส่งกลับให้แก้ไข">
                  <input type="hidden" name="id" value={id} />
                  <label htmlFor="review-note" className="label">
                    เหตุผล / สิ่งที่ต้องแก้ไข
                  </label>
                  <textarea
                    id="review-note"
                    name="note"
                    className="input"
                    rows={4}
                    required
                    minLength={5}
                    maxLength={500}
                    placeholder="เช่น เพิ่มรูปผลงานที่เห็นรายละเอียดชัดเจน"
                  />
                </ActionForm>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
