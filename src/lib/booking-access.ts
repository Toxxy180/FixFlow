import type { Role } from '@prisma/client';

// A technician can also be a customer. Permissions depend on their part in this job.
export function roleForBooking(
  actor: { id: string; role: Role },
  booking: { customerId: string; technician: { userId: string | null } },
): Role | null {
  if (booking.customerId === actor.id) return 'CUSTOMER';
  if (actor.role === 'ADMIN') return 'ADMIN';
  if (actor.role === 'TECHNICIAN' && booking.technician.userId === actor.id) return 'TECHNICIAN';
  return null;
}
