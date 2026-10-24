import type { Role } from '@prisma/client';

export function loginDestination(role: Role) {
  return role === 'ADMIN' ? '/admin' : role === 'TECHNICIAN' ? '/technician' : '/';
}

export function mainNavigation(role?: Role) {
  return role === 'ADMIN'
    ? [
        { href: '/', label: 'ค้นหาช่าง' },
        { href: '/admin', label: 'แดชบอร์ดจัดการระบบ' },
      ]
    : [
        { href: '/', label: 'ค้นหาช่าง' },
        role === 'TECHNICIAN'
          ? { href: '/technician', label: 'งานของฉัน' }
          : { href: '/bookings', label: 'การจองของฉัน' },
      ];
}
