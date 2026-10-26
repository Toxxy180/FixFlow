import Image from 'next/image';

export function TechnicianPortfolio({ name, images }: { name: string; images: { id: string }[] }) {
  return (
    <section className="panel mt-6" aria-labelledby="portfolio-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="portfolio-heading" className="section-title">
          รูปผลงาน
        </h2>
        {images.length ? (
          <p className="text-xs text-muted">{images.length} รูป · กดรูปเพื่อดูขนาดเต็ม</p>
        ) : null}
      </div>
      {images.length ? (
        <div className="mt-5 grid grid-cols-3 gap-4 max-sm:grid-cols-2">
          {images.map((image, index) => (
            <a
              key={image.id}
              href={`/api/images/${image.id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`ดูรูปผลงาน ${index + 1} ของ${name}ขนาดเต็ม`}
              className="group relative block aspect-[4/3] overflow-hidden rounded-xl border border-line bg-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <Image
                unoptimized
                fill
                loading={index === 0 ? 'eager' : 'lazy'}
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 400px"
                src={`/api/images/${image.id}`}
                alt={`รูปผลงาน ${index + 1} ของ${name}`}
                className="object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">ช่างยังไม่ได้เพิ่มรูปผลงาน</p>
      )}
    </section>
  );
}
