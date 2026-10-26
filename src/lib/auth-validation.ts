import { z } from 'zod';
import type { User } from '@supabase/supabase-js';

export const emailSchema = z
  .email('กรุณากรอกอีเมลให้ถูกต้อง')
  .max(254)
  .transform((v) => v.toLowerCase());
export const signupTypeSchema = z.enum(['CUSTOMER', 'TECHNICIAN']);
export const passwordSchema = z
  .string()
  .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  .max(72, 'รหัสผ่านยาวเกินไป')
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'รหัสผ่านยาวเกินไป')
  .regex(/[A-Za-z]/, 'รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษ')
  .regex(/[0-9]/, 'รหัสผ่านต้องมีตัวเลข');
export const passwordPairSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน',
    path: ['confirmPassword'],
  });
export const registrationSchema = passwordPairSchema.safeExtend({
  firstName: z.string().trim().min(1, 'กรุณากรอกชื่อจริง').max(49),
  lastName: z.string().trim().min(1, 'กรุณากรอกนามสกุล').max(50),
  email: emailSchema,
  signupType: signupTypeSchema,
});

// Metadata may describe a display name or onboarding choice, never an authorization role.
export function verifiedProfileData(
  user: Pick<User, 'id' | 'email' | 'email_confirmed_at' | 'user_metadata'>,
) {
  if (
    !user.email_confirmed_at ||
    !z.uuid().safeParse(user.id).success ||
    !emailSchema.safeParse(user.email).success
  )
    throw new Error('Verified email required');
  const email = emailSchema.parse(user.email);
  const metadataName = z
    .string()
    .trim()
    .min(2)
    .max(100)
    .safeParse(user.user_metadata?.display_name ?? user.user_metadata?.full_name);
  return {
    id: user.id,
    email,
    name: metadataName.success ? metadataName.data : email.split('@')[0],
    role: 'CUSTOMER' as const,
  };
}

export function signupDestination(
  role: string,
  signupType: unknown,
  applicationStatus?: string | null,
) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'TECHNICIAN') return '/technician';
  if (role !== 'CUSTOMER' || signupType !== 'TECHNICIAN') return '/';
  return !applicationStatus || applicationStatus === 'NONE' ? '/technician/apply' : '/account';
}

export function applicationOrigin(env: Record<string, string | undefined> = process.env) {
  const value =
    env.APP_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : env.VERCEL_URL
        ? `https://${env.VERCEL_URL}`
        : 'http://localhost:3000');
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  )
    throw new Error('APP_URL must be an HTTPS origin (or localhost for development)');
  return url.origin;
}
