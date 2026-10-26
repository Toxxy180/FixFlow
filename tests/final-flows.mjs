import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { build } = require('esbuild');
const out = await mkdtemp(path.join(tmpdir(), 'fixflow-flows-'));
const qa = (globalThis.__fixflowQA = { db: {}, auth: {}, user: null, ticket: false, issued: 0 });
const mocks = {
  'server-only': '',
  '@/lib/prisma': 'export const prisma = globalThis.__fixflowQA.db;',
  './prisma': 'export const prisma = globalThis.__fixflowQA.db;',
  'next/cache': 'export const revalidatePath=()=>{}; export const updateTag=()=>{};',
  'next/headers':
    'export const headers=async()=>new Headers(); export const cookies=async()=>({get:()=>undefined,delete:()=>{}});',
  'next/navigation': 'export const redirect=url=>{throw Error("REDIRECT:"+url)};',
  '@/lib/supabase/server':
    'export const createClient=async()=>({auth:globalThis.__fixflowQA.auth});',
  '@/lib/auth':
    'export const demoIds={}; export const requireUser=async()=>globalThis.__fixflowQA.user;',
  '@/lib/auth-recovery':
    'export const issueRecoveryTicket=async()=>{globalThis.__fixflowQA.issued++;globalThis.__fixflowQA.ticket=true}; export const consumeRecoveryTicket=async()=>{const v=globalThis.__fixflowQA.ticket;globalThis.__fixflowQA.ticket=false;return v};',
};
let n = 0;
async function load(entry) {
  const filename = path.join(out, `${++n}.cjs`);
  await build({
    entryPoints: [path.join(root, entry)],
    outfile: filename,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    tsconfig: path.join(root, 'tsconfig.json'),
    logLevel: 'silent',
    plugins: [
      {
        name: 'controlled-services',
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) =>
            Object.hasOwn(mocks, a.path)
              ? { path: a.path, namespace: 'mock' }
              : a.path === '@prisma/client'
                ? { path: require.resolve('@prisma/client'), external: true }
                : undefined,
          );
          b.onLoad({ filter: /.*/, namespace: 'mock' }, (a) => ({
            contents: mocks[a.path],
            loader: 'js',
          }));
        },
      },
    ],
  });
  return require(filename);
}
try {
  const { promptPayPayload, crc16 } = await load('src/lib/promptpay.ts');
  assert.equal(crc16('123456789'), '29B1');
  const payload = promptPayPayload('0812345678', 1234);
  const fields = {};
  for (let i = 0; i < payload.length;) {
    const tag = payload.slice(i, i + 2),
      length = Number(payload.slice(i + 2, i + 4));
    fields[tag] = payload.slice(i + 4, i + 4 + length);
    i += 4 + length;
  }
  assert.equal(fields['29'], '0016A00000067701011101130066812345678');
  assert.equal(fields['53'], '764');
  assert.equal(fields['54'], '1234.00');
  assert.equal(fields['58'], 'TH');
  assert.equal(fields['63'], crc16(payload.slice(0, -4)));
  for (const phone of ['', '0212345678', '081234567', '08123456789', '+66812345678'])
    assert.throws(() => promptPayPayload(phone, 10));
  for (const amount of [0, -1, NaN, Infinity, 10.1, 10000001])
    assert.throws(() => promptPayPayload('0812345678', amount));
  console.log('PASS PromptPay: mobile, recipient format, amount bounds, THB and CRC');

  const id = '00000000-0000-4000-8000-000000000001';
  const identity = {
    id,
    email: 'qa@example.com',
    email_confirmed_at: '2026-10-26',
    user_metadata: { signup_type: 'TECHNICIAN', role: 'ADMIN', display_name: 'QA User' },
  };
  let existing = { id, email: identity.email, role: 'CUSTOMER', phone: '0899999999', active: true };
  let intent = { id, email: identity.email, role: 'TECHNICIAN', phone: '0812345678' };
  let created,
    writes = 0,
    reads = 0;
  Object.assign(qa.db, {
    appUser: {
      findUnique: async () => existing,
      upsert: async ({ create, update }) => {
        assert.deepEqual(update, {});
        writes++;
        return (created = create);
      },
      update: async () => {
        throw Error('unexpected update');
      },
    },
    registrationIntent: {
      findUnique: async () => {
        reads++;
        return intent;
      },
    },
  });
  const { syncVerifiedProfile } = await load('src/lib/auth-profile.ts');
  assert.equal((await syncVerifiedProfile(identity)).role, 'CUSTOMER');
  assert.equal(writes, 0);
  assert.equal(reads, 0);
  existing = null;
  assert.equal((await syncVerifiedProfile(identity)).role, 'TECHNICIAN');
  assert.equal(created.phone, intent.phone);
  intent = null;
  assert.equal((await syncVerifiedProfile(identity)).role, 'CUSTOMER');
  console.log(
    'PASS signup roles: trusted intent, preserved existing role, metadata cannot grant roles, repeat reads do not write',
  );

  const customer = { id, role: 'CUSTOMER', active: true };
  const tech = { id: 'tech', role: 'TECHNICIAN', active: true };
  let current = customer;
  let booking = {
    id: 'job',
    customerId: id,
    status: 'AWAITING_PAYMENT',
    totalAmount: 1234,
    technician: { name: 'ช่างทดสอบ', userId: 'tech', active: true, applicationStatus: 'APPROVED' },
    payment: { status: 'UNPAID', recipientPhone: null, recipientName: null },
  };
  let recipient = { ...tech, phone: '0812345678', name: 'ช่างทดสอบ' };
  let paymentWrites = [];
  Object.assign(qa.db, {
    $transaction: async (fn) => fn(qa.db),
    appUser: {
      findUnique: async ({ where }) =>
        where.id === 'tech' && current.id !== 'tech' ? recipient : current,
    },
    booking: { findUnique: async () => booking, update: async () => ({}) },
    payment: {
      update: async ({ data }) => {
        paymentWrites.push(data);
        Object.assign(booking.payment, data);
        return booking.payment;
      },
    },
  });
  const service = await load('src/lib/booking-service.ts');
  await assert.rejects(service.preparePromptPay(tech, 'job'));
  await assert.rejects(service.preparePromptPay({ ...customer, id: 'stranger' }, 'job'));
  await assert.rejects(service.payDemoJob(customer, 'job'));
  recipient.phone = '';
  await assert.rejects(service.preparePromptPay(customer, 'job'));
  recipient.phone = '0812345678';
  const details = await service.preparePromptPay(customer, 'job');
  assert.deepEqual(details, { phone: '0812345678', name: 'ช่างทดสอบ', amount: 1234 });
  recipient.phone = '0899999999';
  assert.equal((await service.preparePromptPay(customer, 'job')).phone, '0812345678');
  await service.payDemoJob(customer, 'job');
  assert.equal(paymentWrites.at(-1).mode, 'PROMPTPAY_DEMO');
  await assert.rejects(service.preparePromptPay(customer, 'job'));
  booking.payment.status = 'UNPAID';
  current = { ...customer, role: 'TECHNICIAN' };
  await assert.rejects(service.preparePromptPay(customer, 'job'));
  current = tech;
  booking.status = 'PENDING';
  booking.technician.applicationStatus = 'PENDING';
  booking.technician.active = false;
  await assert.rejects(service.advanceJob(tech, 'job', 'ACCEPTED'), /อนุมัติ/);
  console.log(
    'PASS payment authorization: owner, role, fresh status, recipient from technician, stable snapshot, manual confirmation and pending-tech denial',
  );

  const application = {
    name: 'ช่างทดสอบ',
    phone: '0812345678',
    category: 'AIRCON',
    description: 'ข้อมูลทดสอบ',
    price: 500,
    experience: 2,
    districtIds: ['1001'],
    workDays: [1],
    availableTimes: ['09:00'],
    portfolioPaths: [`${id}/${id}.webp`],
  };
  const { submitTechnicianApplication } = await load('src/lib/technician-application.ts');
  for (const role of ['CUSTOMER', 'ADMIN']) {
    current = { ...customer, role };
    await assert.rejects(submitTechnicianApplication(current, application), /เฉพาะบัญชี/);
  }
  console.log('PASS application: customer and admin direct submissions rejected');

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test';
  process.env.APP_URL = 'http://localhost:3000';
  current = { ...customer, email: identity.email };
  qa.db.$queryRaw = async () => [{ count: 1 }];
  qa.user = current;
  let verificationCalls = 0,
    updates = 0,
    verifyError = null,
    sent;
  qa.auth.verifyOtp = async (args) => {
    verificationCalls++;
    assert.equal(args.type, 'recovery');
    return { data: { user: verifyError ? null : identity }, error: verifyError };
  };
  qa.auth.updateUser = async () => {
    updates++;
    return { error: null };
  };
  qa.auth.signOut = async () => ({ error: null });
  qa.auth.resetPasswordForEmail = async (email, options) => {
    sent = options;
    return { error: null };
  };
  const auth = await load('src/app/auth/actions.ts');
  const form = new FormData();
  form.set('token_hash', 'bad');
  assert.ok((await auth.confirmPasswordRecovery(form)).error);
  assert.equal(verificationCalls, 0);
  form.set('token_hash', 'a'.repeat(64));
  verifyError = { message: 'expired' };
  assert.ok((await auth.confirmPasswordRecovery(form)).error);
  assert.equal(qa.issued, 0);
  verifyError = null;
  assert.equal((await auth.confirmPasswordRecovery(form)).redirectTo, '/reset-password');
  assert.equal(qa.issued, 1);
  const password = new FormData();
  password.set('password', 'ValidOnly123');
  password.set('confirmPassword', 'ValidOnly123');
  assert.equal(
    (await auth.resetAccountPassword(password)).redirectTo,
    '/login?message=password-updated',
  );
  assert.equal(updates, 1);
  assert.ok((await auth.resetAccountPassword(password)).error);
  assert.equal(updates, 1);
  await auth.sendPasswordReset(identity.email);
  assert.equal(sent.redirectTo, 'http://localhost:3000/auth/recovery');
  console.log(
    'PASS recovery: invalid/expired token, verified recovery type, one-use password ticket, ordinary session denied, canonical email URL',
  );
} finally {
  await rm(out, { recursive: true, force: true });
  delete globalThis.__fixflowQA;
}
