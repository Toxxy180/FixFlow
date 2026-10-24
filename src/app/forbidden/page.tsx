import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
export default function Forbidden() {
  return (
    <main className="shell min-h-[70dvh] py-20 text-center">
      <ShieldAlert size={48} className="mx-auto text-amber-500" />
      <h1 className="mt-5 text-2xl font-bold">บัญชีนี้ไม่มีสิทธิ์เข้าหน้านี้</h1>
      <p className="mt-3 text-muted">กรุณาใช้บัญชีที่มีบทบาทตรงกับเมนู</p>
      <Link href="/" className="btn mt-6">
        กลับไปค้นหาช่าง
      </Link>
    </main>
  );
}
