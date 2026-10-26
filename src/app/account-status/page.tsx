import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccount } from '@/lib/auth';
import { accountRestriction, isAccountAllowed } from '@/lib/account-status';
import { signOut } from '@/app/auth/actions';
export default async function AccountStatusPage() {
  const user = await getAccount();
  if (!user) redirect('/login');
  const allowed = isAccountAllowed(user);
  return (
    <main className="shell py-12">
      <section className="panel mx-auto max-w-xl">
        <h1 className="page-title">สถานะบัญชีของคุณ</h1>
        <p className="mt-3 text-muted">{user.name}</p>
        <p
          className={`mt-5 rounded-xl p-4 text-sm leading-relaxed ${allowed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
        >
          {allowed ? 'บัญชีเปิดใช้งานแล้ว สามารถกลับไปใช้งานได้ตามปกติ' : accountRestriction(user)}
        </p>
        <p className="mt-4 text-sm text-muted">
          ประวัติการจองและข้อมูลบัญชียังถูกเก็บไว้
          การระงับชั่วคราวสิ้นสุดอัตโนมัติเมื่อครบเวลาที่ระบุ
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {allowed ? (
            <Link
              className="btn"
              href={
                user.role === 'TECHNICIAN' ? '/technician' : user.role === 'ADMIN' ? '/admin' : '/'
              }
            >
              กลับไปใช้งาน
            </Link>
          ) : null}
          <form action={signOut}>
            <button className="btn-secondary">ออกจากระบบ</button>
          </form>
        </div>
      </section>
    </main>
  );
}
