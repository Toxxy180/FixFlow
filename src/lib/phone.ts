import { z } from 'zod';

export const mobilePhoneSchema = z
  .string()
  .trim()
  .regex(/^0[689]\d{8}$/, 'กรุณากรอกเบอร์มือถือไทย 10 หลัก เช่น 0812345678');
