import type { JobStatus, Role } from '@prisma/client';
export const statusLabels: Record<JobStatus, string> = {
  PENDING: 'รอตอบรับ',
  ACCEPTED: 'รับงานแล้ว',
  ON_THE_WAY: 'กำลังเดินทาง',
  IN_PROGRESS: 'กำลังดำเนินงาน',
  AWAITING_PAYMENT: 'รอชำระเงิน',
  COMPLETED: 'เสร็จสิ้น',
  CANCELLED: 'ยกเลิกแล้ว',
};
export const roleLabels: Record<Role, string> = {
  CUSTOMER: 'ลูกค้า',
  TECHNICIAN: 'ช่าง',
  ADMIN: 'ผู้ดูแลระบบ',
};
export const nextStatus: Partial<Record<JobStatus, JobStatus>> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'ON_THE_WAY',
  ON_THE_WAY: 'IN_PROGRESS',
  IN_PROGRESS: 'AWAITING_PAYMENT',
};
export const transitionLabels: Partial<Record<JobStatus, string>> = {
  ACCEPTED: 'รับงาน',
  ON_THE_WAY: 'เริ่มเดินทาง',
  IN_PROGRESS: 'เริ่มงาน',
  AWAITING_PAYMENT: 'ส่งยอดเรียกเก็บ',
};
export function canTransition(current: JobStatus, next: JobStatus, role: Role) {
  return (role === 'ADMIN' || role === 'TECHNICIAN') && nextStatus[current] === next;
}
export const statusClass = (status: JobStatus) =>
  status === 'COMPLETED'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'CANCELLED'
      ? 'bg-slate-100 text-slate-500'
      : status === 'PENDING'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-blue-50 text-blue-700';
