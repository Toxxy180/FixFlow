export default function Loading() {
  return (
    <main className="shell min-h-[60dvh] py-10" aria-busy="true" aria-label="กำลังโหลดข้อมูล">
      <p role="status" className="text-sm text-muted">
        กำลังโหลดข้อมูล…
      </p>
      <div
        className="mt-6 grid animate-pulse grid-cols-2 gap-4 max-sm:grid-cols-1"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((id) => (
          <div key={id} className="h-40 rounded-xl bg-slate-100" />
        ))}
      </div>
    </main>
  );
}
