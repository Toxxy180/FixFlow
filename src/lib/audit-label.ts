const labels: Record<string, string> = {
  ACCOUNT_ACTIVE: 'เปิดใช้งานบัญชี',
  ACCOUNT_DISABLED: 'ปิดบัญชี',
  ACCOUNT_SUSPENDED: 'ระงับบัญชีชั่วคราว',
  SAVE_SETTINGS: 'แก้ไขเงื่อนไขการจอง',
  SAVE_TECHNICIAN: 'แก้ไขข้อมูลช่าง',
  APPROVE_TECHNICIAN: 'อนุมัติช่าง',
  REJECT_TECHNICIAN: 'ส่งกลับใบสมัครช่าง',
  APPLY_TECHNICIAN: 'ส่งใบสมัครช่าง',
  SAVE_SERVICE: 'แก้ไขบริการ',
  ARCHIVE_SERVICE: 'ปิดบริการ',
  ARCHIVE_TECHNICIAN: 'ปิดรับงานของช่าง',
  SAVE_USER: 'แก้ไขข้อมูลผู้ใช้ (ประวัติเดิม)',
};
export function auditLabel(action: string) {
  const [code, ...details] = action.split(' · ');
  return [labels[code] || code, ...details].join(' · ');
}
