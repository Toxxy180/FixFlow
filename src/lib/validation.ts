import { z } from 'zod';
import { times, bangkokDate } from './constants';
export const bookingSchema = z.object({
  technicianId: z.string().min(1),
  serviceId: z.string().min(1, 'กรุณาเลือกบริการ'),
  districtId: z.string().regex(/^10\d{2}$/, 'กรุณาเลือกเขตในกรุงเทพมหานคร'),
  customerName: z.string().trim().min(2, 'กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร').max(100),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, 'กรุณากรอกเบอร์โทร 10 หลัก เริ่มต้นด้วย 0'),
  address: z.string().trim().min(10, 'กรุณากรอกที่อยู่ให้ครบถ้วน อย่างน้อย 10 ตัวอักษร').max(500),
  details: z.string().trim().max(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.enum(times),
});
export function validateAppointment(date: string, time: string, maxDays: number, now = new Date()) {
  const appointment = new Date(`${date}T${time}:00+07:00`);
  if (
    !Number.isFinite(appointment.getTime()) ||
    bangkokDate(appointment) !== date ||
    appointment <= now
  )
    return 'กรุณาเลือกวันและเวลาในอนาคต (เวลาประเทศไทย)';
  if (appointment.getTime() > now.getTime() + maxDays * 86400000)
    return `จองล่วงหน้าได้ไม่เกิน ${maxDays} วัน`;
  return null;
}
export function quote(servicePrice: number, technicianPrice: number, travelFee: number) {
  const price = Math.max(servicePrice, technicianPrice);
  return { price, travelFee, totalAmount: price + travelFee };
}
export class UserError extends Error {}
