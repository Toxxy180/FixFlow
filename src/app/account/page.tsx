import { requireUser } from '@/lib/auth';
import { roleLabels } from '@/lib/status';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AccountProfileForm } from '@/components/account-profile-form';
export default async function Account() {
  const user = await requireUser('/account');
  const [avatars, technician] = await Promise.all([
    prisma.userImage.findMany({
      where: { ownerId: user.id, kind: 'AVATAR', path: user.avatarPath ?? '' },
      select: { id: true, path: true },
      take: 1,
    }),
    user.role !== 'ADMIN'
      ? prisma.technician.findUnique({
          where: { userId: user.id },
          select: { active: true, applicationStatus: true, applicationReviewNote: true },
        })
      : Promise.resolve(null),
  ]);
  return (
    <main className="shell min-h-[70dvh] py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold">บัญชีของฉัน</h1>
        <p className="mt-2 text-sm text-muted">
          {roleLabels[user.role]} · {user.email}
        </p>
        <AccountProfileForm
          name={user.name}
          phone={user.phone}
          image={avatars[0] ? { ...avatars[0], url: `/api/images/${avatars[0].id}` } : null}
        />
        {user.role === 'TECHNICIAN' ? (
          <div className="panel mt-6 text-sm">
            <p className="mb-3 text-muted">
              {technician?.active
                ? 'โปรไฟล์ช่างของคุณได้รับอนุมัติและเปิดรับงานแล้ว'
                : 'โปรไฟล์ยังไม่เปิดรับงาน กรุณาติดต่อผู้ดูแลระบบ'}
            </p>
            <Link href="/technician" className="font-semibold text-primary">
              ไปที่งานของฉัน →
            </Link>
          </div>
        ) : user.role === 'CUSTOMER' ? (
          <details className="mt-6 rounded-xl border border-line bg-white p-5">
            <summary className="cursor-pointer font-semibold text-primary">
              สมัครเป็นช่าง / เปิดรับงาน
            </summary>
            <div className="mt-4 space-y-3 text-sm">
              {technician ? (
                <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">
                  {technician.applicationStatus === 'APPROVED'
                    ? 'โปรไฟล์ช่างเดิมยังถูกเก็บไว้ ปัจจุบันบัญชีเป็นลูกค้า กรุณาติดต่อผู้ดูแลระบบหากต้องการกลับมาเปิดรับงาน'
                    : technician.applicationStatus === 'NONE'
                      ? 'ยังไม่ได้ส่งใบสมัคร กรุณากรอกข้อมูลและแนบรูปเพื่อให้ผู้ดูแลตรวจสอบ'
                      : technician.applicationStatus === 'REJECTED'
                        ? `Admin ขอให้แก้ไขใบสมัคร: ${technician.applicationReviewNote}`
                        : 'ส่งใบสมัครช่างแล้ว รอ Admin ตรวจสอบและอนุมัติ ระหว่างนี้คุณยังจองบริการได้ตามปกติ'}
                </p>
              ) : (
                <>
                  <p className="text-muted">
                    ต้องการเปิดรับงานในกรุงเทพฯ? กรอกข้อมูลบริการ พื้นที่ และเวลารับงาน แล้วรอ Admin
                    อนุมัติ
                  </p>
                  <Link href="/technician/apply" className="btn text-sm">
                    กรอกใบสมัครช่าง
                  </Link>
                </>
              )}
              {technician &&
              user.role === 'CUSTOMER' &&
              technician.applicationStatus !== 'APPROVED' ? (
                <Link href="/technician/apply" className="btn text-sm">
                  {technician.applicationStatus === 'NONE'
                    ? 'กรอกใบสมัครช่าง'
                    : 'ดูรายละเอียด / แก้ไขใบสมัคร'}
                </Link>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </main>
  );
}
