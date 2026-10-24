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
import { googleAuthEnabled } from '@/lib/auth-providers';
import { issueRecoveryTicket, consumeRecoveryTicket } from '@/lib/auth-recovery';

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
  if (!profile.active) {
    await (await createClient()).auth.signOut();
    return { error: 'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' };
  }
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
    const { data, error } = await (
      await createClient()
    ).auth.signInWithPassword({ email: email.data, password });
    if (error?.code === 'email_not_confirmed')
      return {
        step: 'VERIFY',
        error: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ สามารถขอรหัสใหม่ได้ด้านล่าง',
      };
    if (error || !data.user?.email_confirmed_at) return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
    return await signedIn(data.user);
  } catch {
    return { error: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' };
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
    if (
      !(await throttle('send', parsed.data.email, 1, 60)) ||
      !(await throttle('send-ip', '', 10, 900))
    )
      return { error: 'ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' };
    const { name, email, password, signupType } = parsed.data;
    const client = await createClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: name, signup_type: signupType } },
    });
    if (error)
      return {
        error: 'สมัครไม่สำเร็จ กรุณาตรวจอีเมลและรหัสผ่าน หรือลองเข้าสู่ระบบหากเคยสมัครแล้ว',
      };
    if (data.session) {
      await client.auth.signOut();
      return { error: 'ระบบยืนยันอีเมลยังไม่ได้เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
    }
    return { success: true, step: 'VERIFY' };
  } catch {
    return { error: 'สมัครไม่สำเร็จ กรุณาลองใหม่' };
  }
}

export async function resendSignupCode(input: string): Promise<AuthActionResult> {
  const email = emailSchema.safeParse(input.trim());
  if (!email.success || !hasSupabase()) return { error: 'กรุณาตรวจสอบอีเมล' };
  try {
    if (!(await throttle('send', email.data, 1, 60)) || !(await throttle('send-ip', '', 10, 900)))
      return { error: 'ขอรหัสบ่อยเกินไป กรุณารอสักครู่' };
    const { error } = await (
      await createClient()
    ).auth.resend({ type: 'signup', email: email.data });
    return error ? { error: 'ส่งรหัสไม่สำเร็จ กรุณาลองใหม่' } : { success: true };
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
      return { error: 'ขอรหัสบ่อยเกินไป กรุณารอสักครู่' };
    const { error } = await (await createClient()).auth.resetPasswordForEmail(email.data);
    if (error) return { error: 'ส่งรหัสไม่สำเร็จ กรุณาลองใหม่' };
    return { success: true, step: 'VERIFY' };
  } catch {
    return { error: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' };
  }
}

export async function verifyRecoveryCode(input: string, token: string): Promise<AuthActionResult> {
  const email = emailSchema.safeParse(input.trim());
  if (!email.success || !/^\d{6,8}$/.test(token) || !hasSupabase())
    return { error: 'กรุณาตรวจสอบอีเมลและรหัสยืนยัน' };
  try {
    if (!(await throttle('verify', email.data, 10, 600)))
      return { error: 'ลองรหัสบ่อยเกินไป กรุณารอสักครู่' };
    const client = await createClient();
    const { data, error } = await client.auth.verifyOtp({
      email: email.data,
      token,
      type: 'recovery',
    });
    if (error || !data.user?.email_confirmed_at)
      return { error: 'รหัสไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่' };
    const profile = await syncVerifiedProfile(data.user);
    if (!profile.active) {
      await client.auth.signOut();
      return { error: 'บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' };
    }
    await issueRecoveryTicket(data.user.id);
    return { success: true, step: 'RESET' };
  } catch {
    return { error: 'ยืนยันไม่สำเร็จ กรุณาลองใหม่' };
  }
}

export async function resetAccountPassword(form: FormData): Promise<AuthActionResult> {
  const parsed = passwordPairSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const user = await requireUser('/forgot-password');
    if (!(await consumeRecoveryTicket(user.id)))
      return { error: 'กรุณาขอและยืนยัน OTP ใหม่ก่อนตั้งรหัสผ่าน' };
    const client = await createClient();
    const { error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error) return { error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาขอ OTP ใหม่แล้วลองอีกครั้ง' };
    await client.auth.signOut({ scope: 'global' });
    revalidatePath('/', 'layout');
    return { success: true, redirectTo: '/login?message=password-updated' };
  } catch {
    return { error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาขอ OTP ใหม่แล้วลองอีกครั้ง' };
  }
}

export async function startGoogleLogin(kind: string): Promise<AuthActionResult> {
  if (!['LOGIN', 'CUSTOMER', 'TECHNICIAN'].includes(kind) || !hasSupabase())
    return { error: 'คำขอเข้าสู่ระบบไม่ถูกต้อง' };
  try {
    if (!(await throttle('google-ip', '', 30, 900)))
      return { error: 'เข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่' };
    if (!(await googleAuthEnabled()))
      return { error: 'การเข้าสู่ระบบด้วย Google ยังไม่เปิดให้ใช้งาน กรุณาใช้อีเมลและรหัสผ่าน' };
    const jar = await cookies();
    jar.set('fixflow-signup-kind', kind, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    });
    const { data, error } = await (
      await createClient()
    ).auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${applicationOrigin()}/auth/callback`,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error || !data.url) {
      jar.delete('fixflow-signup-kind');
      return { error: 'เริ่มเข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่' };
    }
    return { success: true, redirectTo: data.url };
  } catch {
    return { error: 'เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองใหม่' };
  }
}

export async function demoLogin(role: string): Promise<ActionResult> {
  if (!isDemoMode() || !Object.hasOwn(demoIds, role)) return { error: 'โหมดสาธิตไม่เปิดใช้งาน' };
  const host = (await headers()).get('host')?.split(':')[0];
  if (!host || !['localhost', '127.0.0.1'].includes(host))
    return { error: 'โหมดสาธิตใช้ได้เฉพาะในเครื่อง' };
  if (!(await prisma.appUser.findUnique({ where: { id: demoIds[role] } })))
    return { error: 'กรุณารัน npm run db:seed:demo ก่อน' };
  (await cookies()).set('fixflow-demo', role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  });
  revalidatePath('/', 'layout');
  return {
    success: true,
    redirectTo: loginDestination(role as 'ADMIN' | 'TECHNICIAN' | 'CUSTOMER'),
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
    .object({ name: z.string().trim().min(2).max(100), phone: z.string().regex(/^0\d{9}$|^$/) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'กรุณากรอกชื่อและเบอร์โทรให้ถูกต้อง' };
  await prisma.appUser.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath('/', 'layout');
  return { success: true };
}
