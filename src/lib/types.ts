import type { AppUser, Prisma } from '@prisma/client';
export type PublicUser = Pick<AppUser, 'id' | 'name' | 'email' | 'role' | 'phone' | 'avatarPath'>;
export type PublicTechnician = {
  id: string;
  name: string;
  initials: string;
  category: string;
  categoryName: string;
  district: string;
  description: string;
  price: number;
  color: string;
  experience: number;
  districtIds: string[];
  rating: number | null;
  reviewCount: number;
  avatarPath?: string | null;
};
export type PublicService = { id: string; name: string; categoryId: string; price: number };
export const bookingInclude = {
  technician: true,
  district: true,
  payment: true,
  parts: true,
  history: { orderBy: { createdAt: 'asc' as const } },
  review: true,
} satisfies Prisma.BookingInclude;
export type FullBooking = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;
export type ActionResult = {
  error?: string;
  success?: boolean;
  reference?: string;
  redirectTo?: string;
};
export type AuthActionResult = ActionResult & { step?: 'VERIFY' | 'EMAIL_SENT' | 'RESET' };
