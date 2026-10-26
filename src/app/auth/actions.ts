'use server';
import { createHash } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasSupabase, isDemoMode } from '@/lib/config';
import { loginDestination } from '@/lib/navigation';
import { demoIds, requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { ActionResult, AuthActionResult } from '@/lib/types';
import {
  applicationOrigin,
  emailSchema,
  registrationSchema,
  passwordPairSchema,
} from '@/lib/auth-validation';
import { destinationAfterAuth, syncVerifiedProfile } from '@/lib/auth-profile';
import { isAccountAllowed } from '@/lib/account-status';
import {
  createRegistration,
  resendConfirmation,
  passwordLogin,
  duplicateEmailMessage,
  type EmailStatus,
} from '@/lib/signup-service';
import { consumeRecoveryTicket, issueRecoveryTicket } from '@/lib/auth-recovery';
import { rememberRegistration } from '@/lib/registration-intent';
import { mobilePhoneSchema } from '@/lib/phone';

async function throttle(kind: string, email: string, limit: number, seconds: number) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const key = createHash('sha256')
    .update(`${kind}:${email || ip}`)
    .digest('hex');
  const now = new Date();
  // PostgreSQL atomic UPSERT prevents simultaneous requests bypassing the limit.
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${key}, 1, ${new Date(now.getTime() + seconds * 1000)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${new Date(now.getTime() + seconds * 1000)} ELSE "RateLimit"."expiresAt" END
    RETURNING "count"`;
  return rows[0].count <= limit;
}

async function signedIn(user: User): Promise<AuthActionResult> {
  const profile = await syncVerifiedProfile(user);
  if (!isAccountAllowed(profile)) return { success: true, redirectTo: '/account-status' };
  revalidatePath('/', 'layout');
  return {
    success: true,
    redirectTo: await destinationAfterAuth(profile, user.user_metadata?.signup_type),
  };
}

export async function loginWithPassword(form: FormData): Promise<AuthActionResult> {
  const email = emailSchema.safeParse(String(form.get('email') || '').trim());
  const password = form.get('password');
  if (!email.success || typeof password !== 'string' || !password || password.length > 1024)
    return { error: 'กรุณากรอกอีเมลและรหัสผ่านให้ครบ' };
  if (!hasSupabase()) return { error: 'ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ' };
  try {
    if (
      !(await throttle('login', email.data, 10, 900)) ||
      !(await throttle('login-ip', '', 40, 900))
    )
      return { error: 'เข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' };
    return await passwordLogin(email.data, password, (await createClient()).auth, signedIn, () =>
      resendSignupCode(email.data),
    );
  } catch {
    return { error: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' };
  }
}

async function emailStatus(email: string): Promise<EmailStatus> {
  const rows = await prisma.$queryRaw<
    { status: EmailStatus }[]
  >`SELECT public.fixflow_email_status(${email}::text) AS status`;
  const status = rows[0]?.status;
  if (!['AVAILABLE', 'UNCONFIRMED', 'CONFIRMED'].includes(status))
    throw new Error('Email lookup unavailable');
  return status;
}

export async function checkRegistrationEmail(
  input: string,
): Promise<{ status?: EmailStatus; error?: string }> {
  const email = emailSchema.safeParse(input.trim());
  if (!email.success || !hasSupabase()) return {};
  try {
    if (!(await throttle('email-check-ip', '', 30, 300)))
      return { error: 'ตรวจสอบบ่อยเกินไป กรุณารอสักครู่' };
    return { status: await emailStatus(email.data) };
  } catch {
    return { error: 'ตรวจสอบอีเมลยังไม่ได้ กรุณาลองใหม่' };
  }
}

export async function registerAccount(form: FormData): Promise<AuthActionResult> {
  const parsed = registrationSchema.safeParse({
    ...Object.fromEntries(form),
    email: String(form.get('email') || '').trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!hasSupabase()) return { error: 'ระบบสมัครสมาชิกยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ' };
  try {
    if (!(await throttle('signup-check-ip', '', 30, 300)))
      return { error: 'สมัครบ่อยเกินไป กรุณารอสักครู่' };
    const status = await emailStatus(parsed.data.email);
    if (status === 'CONFIRMED') return { error: duplicateEmailMessage };
    if (
      !(await throttle('send', parsed.data.email, 1, 60)) ||
      !(await throttle('send-ip', '', 10, 900))
    )
      return {
        step: status === 'UNCONFIRMED' ? 'VERIFY' : undefined,
        error: 'กรุณารอ 60 วินาทีก่อนขอรหัสใหม่ และใช้รหัสล่าสุดที่ได้รับ',
        retryAfter: 60,
      };
    return await createRegistration(
      parsed.data,
      status,
      (await createClient()).auth,
      rememberRegistration,
    );
  } catch {
    return { error: 'สมัครไม่สำเร็จ กรุณาลองใหม่' };
  }
}

export async function resendSignupCode(input: string): Promise<AuthActionResult> {
  const email = emailSchema.safeParse(input.trim());
  if (!email.success || !hasSupabase()) return { error: 'กรุณาตรวจสอบอีเมล' };
  try {
    if (!(await throttle('send', email.data, 1, 60)) || !(await throttle('send-ip', '', 10, 900)))
      return { error: 'กรุณารอ 60 วินาทีก่อนขอรหัสใหม่ และใช้รหัสล่าสุดที่ได้รับ', retryAfter: 60 };
    return await resendConfirmation(
      email.data,
      await emailStatus(email.data),
      (await createClient()).auth,
    );
  } catch {
    return { error: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' };
  }
}

export async function verifyRegistration(input: string, token: string): Promise<AuthActionResult> {
  const email = emailSchema.safeParse(input.trim());
  if (!email.success || !/^\d{6,8}$/.test(token) || !hasSupabase())
    return { error: 'กรุณาตรวจสอบอีเมลและรหัสยืนยัน' };
  try {
    if (!(await throttle('verify', email.data, 10, 600)))
      return { error: 'ลองรหัสบ่อยเกินไป กรุณารอสักครู่' };
    const { data, error } = await (
      await createClient()
    ).auth.verifyOtp({ email: email.data, token, type: 'email' });
    if (error || !data.user?.email_confirmed_at)
      return { error: 'รหัสไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่' };
    return await signedIn(data.user);
  } catch {
    return { error: 'ยืนยันไม่สำเร็จ กรุณาลองใหม่' };
  }
}

export async function sendPasswordReset(input: string): Promise<AuthActionResult> {
  const email = emailSchema.safeParse(input.trim());
  if (!email.success || !hasSupabase()) return { error: 'กรุณากรอกอีเมลให้ถูกต้อง' };
  try {
    if (!(await throttle('send', email.data, 1, 60)) || !(await throttle('send-ip', '', 10, 900)))
      return { error: 'ขอลิงก์บ่อยเกินไป กรุณารอสักครู่' };
    const { error } = await (
      await createClient()
    ).auth.resetPasswordForEmail(email.data, {
      redirectTo: `${applicationOrigin()}/auth/recovery`,
    });
    if (error) return { error: 'ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่' };
    return { success: true, step: 'EMAIL_SENT' };
  } catch {
    return { error: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' };
  }
}

export async function resetAccountPassword(form: FormData): Promise<AuthActionResult> {
  const parsed = passwordPairSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const user = await requireUser('/forgot-password');
    if (!(await consumeRecoveryTicket(user.id)))
      return { error: 'กรุณาขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน แล้วคลิกลิงก์ในอีเมลก่อนตั้งรหัสผ่าน' };
    const client = await createClient();
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error)
      return {
        error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาขอลิงก์ใหม่จากหน้าลืมรหัสผ่านแล้วลองอีกครั้ง',
      };
    await client.auth.signOut({ scope: 'global' });
    revalidatePath('/', 'layout');
    return { success: true, redirectTo: '/login?message=password-updated' };
  } catch {
    return { error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาขอลิงก์ใหม่จากหน้าลืมรหัสผ่านแล้วลองอีกครั้ง' };
  }
}

export async function demoLogin(role: string): Promise<ActionResult> {
  if (!isDemoMode() || !Object.hasOwn(demoIds, role)) return { error: 'โหมดสาธิตไม่เปิดใช้งาน' };
  const host = (await headers()).get('host')?.split(':')[0];
  if (!host || !['localhost', '127.0.0.1'].includes(host))
    return { error: 'โหมดสาธิตใช้ได้เฉพาะในเครื่อง' };
  const account = await prisma.appUser.findUnique({ where: { id: demoIds[role] } });
  if (!account) return { error: 'กรุณารัน npm run db:seed:demo ก่อน' };
  (await cookies()).set('fixflow-demo', role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  });
  revalidatePath('/', 'layout');
  return {
    success: true,
    redirectTo: isAccountAllowed(account)
      ? loginDestination(role as 'ADMIN' | 'TECHNICIAN' | 'CUSTOMER')
      : '/account-status',
  };
}

export async function signOut() {
  if (hasSupabase()) await (await createClient()).auth.signOut();
  (await cookies()).delete('fixflow-demo');
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await requireUser('/account');
  const parsed = z
    .object({ name: z.string().trim().min(2).max(100), phone: mobilePhoneSchema })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'กรุณากรอกชื่อและเบอร์โทรให้ถูกต้อง' };
  await prisma.appUser.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function confirmPasswordRecovery(form: FormData): Promise<AuthActionResult> {
  const tokenHash = form.get('token_hash');
  if (typeof tokenHash !== 'string' || !/^[a-f0-9]{64}$/i.test(tokenHash))
    return { error: 'ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่' };
  try {
    if (!(await throttle('recovery-verify-ip', '', 20, 600)))
      return { error: 'ลองบ่อยเกินไป กรุณารอสักครู่' };
    const client = await createClient();
    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });
    if (error || !data.user?.email_confirmed_at)
      return { error: 'ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่' };
    const profile = await syncVerifiedProfile(data.user);
    if (!isAccountAllowed(profile)) return { success: true, redirectTo: '/account-status' };
    await issueRecoveryTicket(data.user.id);
    return { success: true, redirectTo: '/reset-password' };
  } catch {
    return { error: 'ยืนยันลิงก์ไม่สำเร็จ กรุณาลองใหม่' };
  }
}
