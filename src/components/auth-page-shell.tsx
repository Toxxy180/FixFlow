export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell grid min-h-[calc(100dvh-142px)] grid-cols-2 items-center gap-12 py-12 max-lg:gap-10 max-md:grid-cols-1">
      <section className="max-md:hidden">
        <h2 className="text-[88px] max-xl:text-[70px] font-bold leading-[1.2] tracking-tight">
          บ้านพร้อม
          <br />
          <span className="text-primary">เมื่อคุณพร้อม</span>
        </h2>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
          จองช่าง ดูแลงานบ้าน หรือร่วมเป็นช่างกับ FixFlow ในกรุงเทพมหานคร 50 เขต
        </p>
        <p className="mt-7 inline-block rounded-xl bg-soft px-4 py-3 text-sm text-primary">
          ยืนยันบัญชี · นัดหมายสะดวก · ติดตามงานได้
        </p>
      </section>
      <div className="mx-auto w-full max-w-[600px]">{children}</div>
    </main>
  );
}
