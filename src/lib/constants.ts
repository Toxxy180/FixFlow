export const categories = [
  { id: 'ALL', label: 'ทั้งหมด' },
  { id: 'AIRCON', label: 'ช่างแอร์' },
  { id: 'ELECTRIC', label: 'ช่างไฟฟ้า' },
  { id: 'PLUMBING', label: 'ช่างประปา' },
  { id: 'GENERAL', label: 'ช่างทั่วไป' },
] as const;
export const times = ['09:00', '11:00', '13:00', '15:00'] as const;
export const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
export const currency = (value: number) => new Intl.NumberFormat('th-TH').format(value);
export function bangkokDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(
    new Date(`${value}T00:00:00+07:00`),
  );
