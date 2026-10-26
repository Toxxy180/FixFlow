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
    user.role === 'TECHNICIAN'
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
              เบอร์โทรในบัญชีนี้ใช้สร้าง QR รับเงินจากลูกค้า ต้องผูก PromptPay กับธนาคารแล้ว
            </p>
            <p className="mb-3" role="status">
              {technician?.applicationStatus === 'PENDING'
                ? 'ส่งใบสมัครแล้ว รอ Admin อนุมัติก่อนรับงาน'
                : technician?.applicationStatus === 'REJECTED'
                  ? 'กรุณาแก้ไขใบสมัคร: ' + technician.applicationReviewNote
                  : technician?.active
                    ? 'โปรไฟล์ช่างเปิดรับงานแล้ว'
                    : technician?.applicationStatus === 'APPROVED'
                      ? 'โปรไฟล์พักรับงาน กรุณาติดต่อ Admin'
                      : 'กรุณากรอกใบสมัครให้ Admin ตรวจสอบก่อนรับงาน'}
            </p>
            <Link
              href={
                !technician || ['PENDING', 'REJECTED'].includes(technician.applicationStatus)
                  ? '/technician/apply'
                  : '/technician'
              }
              className="font-semibold text-primary"
            >
              {!technician || ['PENDING', 'REJECTED'].includes(technician.applicationStatus)
                ? 'กรอกข้อมูล / ดูใบสมัครช่าง →'
                : 'ไปที่งานของฉัน →'}
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
