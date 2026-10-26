import { accountStatusLabels } from '@/lib/account-status';
export const roleRing = {
  CUSTOMER: 'ring-2 ring-blue-400 ring-offset-2',
  TECHNICIAN: 'ring-2 ring-amber-400 ring-offset-2',
  ADMIN: 'ring-2 ring-purple-400 ring-offset-2',
};
export function UserStatusBadge({ status }: { status: keyof typeof accountStatusLabels }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : status === 'SUSPENDED' ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'}`}
    >
      {accountStatusLabels[status]}
    </span>
  );
}
