import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { roleLabels } from '@/lib/status';
import { saveUser } from '@/app/admin/actions';
import { ActionForm } from '@/components/action-form';
export default async function AdminUsers() {
  const actor = await requireRole('ADMIN', '/admin/users');
  const users = await prisma.appUser.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return (
    <>
      <h1 className="page-title">ผู้ใช้งาน</h1>
      <p className="mt-2 text-sm text-muted">กำหนดบทบาทและเปิด/ระงับบัญชีที่ยืนยันอีเมลแล้ว</p>
      <p className="mt-2 text-sm text-muted">
        ผู้สมัครช่างต้องผ่านการตรวจใบสมัครในหน้าจัดการช่างก่อน
        การระงับบัญชีจะเก็บใบสมัครและรูปเดิมไว้ เมื่อเปิดบัญชีกลับ
        ให้เปิดรับงานอีกครั้งจากหน้าจัดการช่าง
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        {users.map((u) => (
          <section className="panel" key={u.id}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold">{u.name}</h2>
              <p className="mt-1 break-all text-sm text-muted">{u.email}</p>
            </div>
            {u.id === actor.id ? (
              <p className="rounded-lg bg-soft p-3 text-sm text-primary">
                บัญชีของคุณ · ผู้ดูแลระบบ
              </p>
            ) : (
              <ActionForm action={saveUser}>
                <input name="id" type="hidden" value={u.id} />
                <div>
                  <label className="label" htmlFor={`role-${u.id}`}>
                    บทบาท
                  </label>
                  <select id={`role-${u.id}`} name="role" className="input" defaultValue={u.role}>
                    {Object.entries(roleLabels).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input name="active" type="checkbox" defaultChecked={u.active} />
                  เปิดใช้งานบัญชี
                </label>
              </ActionForm>
            )}
          </section>
        ))}
      </div>
      <p className="mt-5 text-xs text-muted">
        แสดงผู้ใช้ล่าสุด 100 คน · ผู้ใช้ใหม่เริ่มต้นเป็นลูกค้า และเปลี่ยนสิทธิ์เองไม่ได้
      </p>
    </>
  );
}
