'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { Wrench, LogOut, ChevronDown, ArrowLeft } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import type { PublicUser } from '@/lib/types';
import { mainNavigation } from '@/lib/navigation';
import { UserAvatar } from './user-avatar';
export function Header({ user, siteName }: { user: PublicUser | null; siteName: string }) {
  const pathname = usePathname();
  const accountMenu = useRef<HTMLDetailsElement>(null);
  return (
    <header className="relative z-20 border-b border-line bg-white">
      <div className="shell flex min-h-20 items-center gap-10 max-sm:flex-wrap max-sm:gap-3 max-sm:py-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 text-[27px] font-bold tracking-tight"
          aria-label="FixFlow หน้าแรก"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
            <Wrench size={27} strokeWidth={2.5} />
          </span>
          {siteName}
        </Link>
        {['/login', '/register', '/forgot-password'].includes(pathname) ? (
          <Link
            href="/"
            className="ml-auto flex items-center gap-2 text-sm font-semibold text-primary"
          >
            <ArrowLeft size={18} />
            กลับไปค้นหาช่าง
          </Link>
        ) : (
          <>
            <nav
              className="flex self-stretch gap-7 max-sm:order-3 max-sm:w-full max-sm:gap-6"
              aria-label="เมนูหลัก"
            >
              {mainNavigation(user?.role).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    pathname === item.href ||
                    (item.href === '/admin' && pathname.startsWith('/admin/'))
                      ? 'page'
                      : undefined
                  }
                  className={`flex items-center border-b-[3px] pt-[3px] text-sm max-sm:py-2 ${pathname === item.href || (item.href === '/admin' && pathname.startsWith('/admin/')) ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted hover:text-primary'}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto">
              {user ? (
                <details ref={accountMenu} className="relative">
                  <summary
                    aria-label={`เมนูบัญชี ${user.name}`}
                    className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-sm"
                  >
                    <UserAvatar path={user.avatarPath} name={user.name} />
                    <span className="max-w-32 truncate max-sm:hidden">{user.name}</span>
                    <ChevronDown size={15} />
                  </summary>
                  <div
                    className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-line bg-white p-2 shadow-lg"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('a'))
                        accountMenu.current?.removeAttribute('open');
                    }}
                  >
                    <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
                    <Link
                      href="/account"
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-soft"
                    >
                      บัญชีของฉัน
                    </Link>
                    {user.role === 'CUSTOMER' ? (
                      <Link
                        href="/technician/apply"
                        className="block rounded-lg px-3 py-2 text-sm hover:bg-soft"
                      >
                        สมัครเป็นช่าง / เปิดรับงาน
                      </Link>
                    ) : user.role === 'TECHNICIAN' ? (
                      <Link
                        href="/technician"
                        className="block rounded-lg px-3 py-2 text-sm hover:bg-soft"
                      >
                        งานของฉัน
                      </Link>
                    ) : null}
                    <form action={signOut}>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                        <LogOut size={16} />
                        ออกจากระบบ
                      </button>
                    </form>
                  </div>
                </details>
              ) : (
                <Link href="/login" className="btn min-h-10 text-sm">
                  เข้าสู่ระบบ
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
