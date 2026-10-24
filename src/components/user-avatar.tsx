'use client';
import Image from 'next/image';
import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { avatarUrl } from '@/lib/images';

export function UserAvatar({
  path,
  name,
  className = 'h-9 w-9',
}: {
  path?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = avatarUrl(path);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-soft text-primary ${className}`}
    >
      {url && failed !== url ? (
        <Image
          unoptimized
          src={url}
          alt={`รูปโปรไฟล์ ${name}`}
          width={96}
          height={96}
          className="h-full w-full object-cover"
          onError={() => setFailed(url)}
        />
      ) : (
        <UserRound size={22} />
      )}
    </span>
  );
}
