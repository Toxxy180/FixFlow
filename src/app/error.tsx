'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="shell min-h-[70dvh] py-20 text-center">
      <h1 className="text-2xl font-bold">โหลดข้อมูลไม่สำเร็จ</h1>
      <p className="mt-3 text-muted">
        กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบหากปัญหายังเกิดขึ้น
      </p>
      {process.env.NODE_ENV === 'development' && (
        <p className="mt-2 text-sm text-muted">หากเพิ่งติดตั้งให้รัน npm run db:setup ก่อน</p>
      )}
      <button onClick={reset} className="btn mt-6">
        ลองอีกครั้ง
      </button>
    </main>
  );
}
