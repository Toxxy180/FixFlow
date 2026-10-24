import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

// Preserve existing bookmarks while moving role-related choices into the account menu.
export default async function ChooseRole() {
  const user = await requireUser('/account');
  redirect(user.role === 'ADMIN' ? '/admin' : '/account');
}
