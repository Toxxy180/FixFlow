import type { Role } from '@prisma/client';

// A user acts only in their assigned role, including on historical bookings.
export function roleForBooking(
  actor: { id: string; role: Role },
  booking: { customerId: string; technician: { userId: string | null } },
): Role | null {
  if (actor.role === 'CUSTOMER' && booking.customerId === actor.id) return 'CUSTOMER';
  if (actor.role === 'ADMIN') return 'ADMIN';
  if (actor.role === 'TECHNICIAN' && booking.technician.userId === actor.id) return 'TECHNICIAN';
  return null;
}
