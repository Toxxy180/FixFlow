import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { registrationSchema } from '../src/lib/auth-validation';
import {
  createRegistration as registrationService,
  resendConfirmation,
  passwordLogin,
} from '../src/lib/signup-service';
import { accountStatus, isAccountAllowed, accountRestriction } from '../src/lib/account-status';
import { managedUserSchema } from '../src/lib/user-management';
import { bookJob } from '../src/lib/booking-service';

const intentCalls: unknown[][] = [];
const createRegistration = (
  ...args: Parameters<typeof registrationService> extends [...infer A, unknown] ? A : never
) =>
  registrationService(...args, async (...intent) => {
    intentCalls.push(intent);
  });

const input = registrationSchema.parse({
  firstName: ' สมชาย ',
  lastName: ' ทดสอบ ',
  email: 'TEST@example.com',
  phone: '0812345678',
  password: 'TestOnly123',
  confirmPassword: 'TestOnly123',
  signupType: 'TECHNICIAN',
});
function mockAuth(
  options: {
    confirmed?: boolean;
    sendError?: object;
    identities?: object[];
    loginError?: object;
    session?: object;
  } = {},
) {
  const calls: { method: string; input?: unknown }[] = [];
  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    email: input.email,
    email_confirmed_at: options.confirmed ? '2026-10-25' : undefined,
    identities: options.identities ?? [{ id: 'email' }],
  };
  return {
    calls,
    auth: {
      signUp: async (args: unknown) => {
        calls.push({ method: 'signup', input: args });
        return {
          data: { user, session: options.session || null },
          error: options.sendError || null,
        };
      },
      resend: async (args: unknown) => {
        calls.push({ method: 'resend', input: args });
        return { data: {}, error: options.sendError || null };
      },
      signOut: async () => {
        calls.push({ method: 'signout' });
        return { error: null };
      },
      signInWithPassword: async (args: unknown) => {
        calls.push({ method: 'password', input: args });
        return { data: { user }, error: options.loginError || null };
      },
    } as unknown as SupabaseClient['auth'],
  };
}
test('new registration sends signup OTP and records full name, never the password in metadata', async () => {
  const { auth, calls } = mockAuth();
  assert.equal((await createRegistration(input, 'AVAILABLE', auth)).step, 'VERIFY');
  assert.deepEqual(calls, [
    {
      method: 'signup',
      input: {
        email: 'test@example.com',
        password: input.password,
        options: {
          data: {
            display_name: 'สมชาย ทดสอบ',
            full_name: 'สมชาย ทดสอบ',
            signup_type: 'TECHNICIAN',
            phone: input.phone,
          },
        },
      },
    },
  ]);
  assert.deepEqual(intentCalls.at(-1), [
    '00000000-0000-4000-8000-000000000001',
    input.email,
    'TECHNICIAN',
    input.phone,
  ]);
  for (const field of ['firstName', 'lastName', 'phone'])
    assert.equal(registrationSchema.safeParse({ ...input, [field]: '' }).success, false);
});
test('duplicate confirmed email never sends mail; pending signup resends without overwriting credentials', async () => {
  const { auth, calls } = mockAuth();
  assert.match((await createRegistration(input, 'CONFIRMED', auth)).error!, /มีบัญชีแล้ว/);
  assert.equal(calls.length, 0);
  assert.equal((await createRegistration(input, 'UNCONFIRMED', auth)).step, 'VERIFY');
  assert.deepEqual(calls, [{ method: 'resend', input: { type: 'signup', email: input.email } }]);
  assert.match(
    (await createRegistration(input, 'AVAILABLE', mockAuth({ identities: [] }).auth)).error!,
    /มีบัญชีแล้ว/,
  );
});
test('confirmation resend rejects confirmed/nonexistent accounts and exposes cooldown and SMTP failure correctly', async () => {
  const { auth, calls } = mockAuth();
  assert.match((await resendConfirmation(input.email, 'CONFIRMED', auth)).error!, /ไม่ต้องใช้ OTP/);
  assert.ok((await resendConfirmation(input.email, 'AVAILABLE', auth)).error);
  assert.equal(calls.length, 0);
  const failed = await resendConfirmation(
    input.email,
    'UNCONFIRMED',
    mockAuth({ sendError: { status: 429 } }).auth,
  );
  assert.equal(failed.success, undefined);
  assert.equal(failed.retryAfter, 60);
  assert.match(
    (
      await resendConfirmation(
        input.email,
        'UNCONFIRMED',
        mockAuth({ sendError: { code: 'unexpected_failure' } }).auth,
      )
    ).error!,
    /SMTP/,
  );
  assert.match(
    (await createRegistration(input, 'AVAILABLE', mockAuth({ session: {} }).auth)).error!,
    /ยืนยันอีเมล/,
  );
});
test('repeat password login enters directly; only unconfirmed accounts request signup OTP', async () => {
  const { auth, calls } = mockAuth({ confirmed: true });
  let resends = 0;
  const onVerified = async () => ({ success: true, redirectTo: '/' });
  const onUnconfirmed = async () => {
    resends++;
    return { success: true };
  };
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await passwordLogin(input.email, input.password, auth, onVerified, onUnconfirmed))
        .redirectTo,
      '/',
    );
  assert.equal(resends, 0);
  assert.deepEqual(
    calls.map((c) => c.method),
    ['password', 'password'],
  );
  const pending = await passwordLogin(
    input.email,
    input.password,
    mockAuth({ loginError: { code: 'email_not_confirmed' } }).auth,
    onVerified,
    onUnconfirmed,
  );
  assert.equal(pending.step, 'VERIFY');
  assert.equal(resends, 1);
  assert.ok(
    (
      await passwordLogin(
        input.email,
        'wrong',
        mockAuth({ loginError: { code: 'invalid_credentials' } }).auth,
        onVerified,
        onUnconfirmed,
      )
    ).error,
  );
  assert.equal(resends, 1);
});
test('account restrictions expire at the boundary, permanent closure wins, and forged role updates fail', async () => {
  const now = new Date('2026-10-25T00:00:00Z');
  assert.equal(accountStatus({ active: true, suspendedUntil: now }, now), 'ACTIVE');
  assert.equal(accountStatus({ active: false, suspendedUntil: now }, now), 'DISABLED');
  assert.equal(isAccountAllowed({ active: true, suspendedUntil: new Date('2099-01-01') }), false);
  assert.match(
    accountRestriction({ active: false, suspensionReason: 'เหตุผลที่ผู้ใช้เห็น' }),
    /เหตุผลที่ผู้ใช้เห็น/,
  );
  assert.equal(
    managedUserSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      status: 'ACTIVE',
      role: 'ADMIN',
    }).success,
    false,
  );
  for (const role of ['ADMIN', 'TECHNICIAN'] as const)
    await assert.rejects(bookJob({ id: 'actor', role, active: true }, {}), /เฉพาะบัญชีลูกค้า/);
  await assert.rejects(
    bookJob(
      { id: 'actor', role: 'CUSTOMER', active: true, suspendedUntil: new Date('2099-01-01') },
      {},
    ),
    /ถูกระงับ/,
  );
});
