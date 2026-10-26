import { getAccount } from '@/lib/auth';
import { accountRestriction } from '@/lib/account-status';
export async function GET() {
  const user = await getAccount();
  return Response.json(
    { message: user ? accountRestriction(user) : '' },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
