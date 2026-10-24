import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="shell min-h-[70dvh] py-20 text-center">
      <h1 className="text-3xl font-bold">ไม่พบหน้าที่ต้องการ</h1>
      <Link href="/" className="btn mt-6">
        กลับไปค้นหาช่าง
      </Link>
    </main>
  );
}
