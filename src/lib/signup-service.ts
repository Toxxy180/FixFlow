import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { z } from 'zod';
import type { registrationSchema } from './auth-validation';
import type { AuthActionResult } from './types';

export type EmailStatus = 'AVAILABLE' | 'UNCONFIRMED' | 'CONFIRMED';
export const duplicateEmailMessage = 'อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ หรือกดลืมรหัสผ่าน';
export async function passwordLogin(
  email: string,
  password: string,
  auth: Pick<SupabaseClient['auth'], 'signInWithPassword'>,
  onVerified: (user: User) => Promise<AuthActionResult>,
  onUnconfirmed: () => Promise<AuthActionResult>,
): Promise<AuthActionResult> {
  const { data, error } = await auth.signInWithPassword({ email, password });
  if (error?.code === 'email_not_confirmed') return { ...(await onUnconfirmed()), step: 'VERIFY' };
  if (error || !data.user?.email_confirmed_at) return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  // Verified accounts use the password session directly, with no OTP request.
  return onVerified(data.user);
}
export function authSendError(error: { code?: string; status?: number }): AuthActionResult {
  if (
    error.status === 429 ||
    ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code || '')
  )
    return {
      error: 'ส่งอีเมลถี่เกินไปหรือเกินโควตาผู้ให้บริการ กรุณารอสักครู่แล้วลองใหม่',
      retryAfter: 60,
    };
  if (['email_exists', 'user_already_exists'].includes(error.code || ''))
    return { error: duplicateEmailMessage };
  return {
    error:
      'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ หากยังไม่ได้ให้ผู้ดูแลตรวจ SMTP และ Auth Logs ของ Supabase',
  };
}

export async function resendConfirmation(
  email: string,
  status: EmailStatus,
  auth: Pick<SupabaseClient['auth'], 'resend'>,
): Promise<AuthActionResult> {
  if (status === 'CONFIRMED')
    return { error: 'อีเมลนี้ยืนยันแล้ว เข้าสู่ระบบด้วยรหัสผ่านได้เลย ไม่ต้องใช้ OTP อีก' };
  if (status === 'AVAILABLE') return { error: 'ยังไม่พบบัญชีอีเมลนี้ กรุณาสมัครสมาชิกก่อน' };
  const { error } = await auth.resend({ type: 'signup', email });
  return error
    ? authSendError(error)
    : {
        success: true,
        step: 'VERIFY',
        retryAfter: 60,
        message: 'ส่งรหัสยืนยันใหม่แล้ว กรุณาใช้รหัสจากอีเมลล่าสุด',
      };
}

export async function createRegistration(
  input: z.output<typeof registrationSchema>,
  status: EmailStatus,
  auth: Pick<SupabaseClient['auth'], 'signUp' | 'resend' | 'signOut'>,
): Promise<AuthActionResult> {
  if (status === 'CONFIRMED') return { error: duplicateEmailMessage };
  // Reusing an unverified address must not overwrite its original password or identity.
  if (status === 'UNCONFIRMED')
    return { ...(await resendConfirmation(input.email, status, auth)), step: 'VERIFY' };
  const name = `${input.firstName} ${input.lastName}`;
  const { data, error } = await auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { display_name: name, full_name: name, signup_type: input.signupType } },
  });
  if (error) return authSendError(error);
  // Supabase can return an obfuscated user for a concurrent duplicate signup.
  if (data.user?.identities?.length === 0) return { error: duplicateEmailMessage };
  if (data.session) {
    await auth.signOut();
    return { error: 'ระบบยืนยันอีเมลยังไม่ได้เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
  }
  if (!data.user) return { error: 'สมัครไม่สำเร็จ กรุณาลองใหม่' };
  return {
    success: true,
    step: 'VERIFY',
    retryAfter: 60,
    message: 'ส่งรหัสยืนยันแล้ว ตรวจสอบกล่องอีเมลหรือจดหมายขยะ',
  };
}
