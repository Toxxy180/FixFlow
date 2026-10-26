import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, validateAppointment, bookingSchema } from '../src/lib/validation';
import { canTransition } from '../src/lib/status';
import { safeNext, isDemoMode } from '../src/lib/config';
import { bangkokDate } from '../src/lib/constants';
import { roleForBooking } from '../src/lib/booking-access';
import { technicianApplicationSchema } from '../src/lib/technician-application';
import { loginDestination, mainNavigation } from '../src/lib/navigation';
import { accountProfileSchema } from '../src/lib/account-profile';
import { limitedImageForm, sameOrigin } from '../src/lib/upload-request';
import { bookJob } from '../src/lib/booking-service';
import sharp from 'sharp';
import { prepareImage } from '../src/lib/image-processing';
import { validImagePath, avatarUrl, MAX_IMAGE_BYTES } from '../src/lib/images';
import {
  registrationSchema,
  passwordPairSchema,
  verifiedProfileData,
  signupDestination,
  applicationOrigin,
} from '../src/lib/auth-validation';

test('registration validates passwords and public account choices without accepting privilege fields', () => {
  const input = {
    firstName: 'ผู้สมัคร',
    lastName: 'ทดสอบ',
    email: 'EXAMPLE@example.com',
    password: 'ExampleOnly123',
    confirmPassword: 'ExampleOnly123',
    signupType: 'TECHNICIAN',
    role: 'ADMIN',
    active: true,
  };
  const parsed = registrationSchema.parse(input);
  assert.equal(parsed.email, 'example@example.com');
  assert.equal(parsed.signupType, 'TECHNICIAN');
  assert.equal('role' in parsed, false);
  assert.equal('active' in parsed, false);
  assert.equal(registrationSchema.safeParse({ ...input, signupType: 'ADMIN' }).success, false);
  assert.equal(
    registrationSchema.safeParse({ ...input, confirmPassword: 'Different123' }).success,
    false,
  );
  for (const password of ['short1', 'onlyletters', '123456789', `A1${'ก'.repeat(30)}`]) {
    assert.equal(
      passwordPairSchema.safeParse({ password, confirmPassword: password }).success,
      false,
    );
  }
});

test('verified signup and Google profiles never copy roles, passwords or activation from metadata', () => {
  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'TEST@example.com',
    email_confirmed_at: '2026-10-23T00:00:00Z',
    user_metadata: {
      role: 'ADMIN',
      active: true,
      password: 'not-stored',
      display_name: 'ชื่อผู้สมัคร',
      signup_type: 'TECHNICIAN',
    },
  };
  assert.deepEqual(verifiedProfileData(user), {
    id: user.id,
    email: 'test@example.com',
    name: 'ชื่อผู้สมัคร',
    role: 'CUSTOMER',
  });
  assert.equal(
    verifiedProfileData({ ...user, user_metadata: { full_name: 'Google Name', role: 'ADMIN' } })
      .name,
    'Google Name',
  );
  assert.throws(() => verifiedProfileData({ ...user, email_confirmed_at: undefined }));
  assert.throws(() => verifiedProfileData({ ...user, email: undefined }));
});

test('technician signup continues onboarding and preserves admin and approved technician destinations', () => {
  assert.equal(signupDestination('CUSTOMER', 'TECHNICIAN'), '/technician/apply');
  assert.equal(signupDestination('CUSTOMER', 'TECHNICIAN', 'PENDING'), '/account');
  assert.equal(signupDestination('CUSTOMER', 'TECHNICIAN', 'REJECTED'), '/account');
  assert.equal(signupDestination('TECHNICIAN', 'TECHNICIAN', 'APPROVED'), '/technician');
  assert.equal(signupDestination('ADMIN', 'TECHNICIAN'), '/admin');
  assert.equal(signupDestination('CUSTOMER', 'ADMIN'), '/');
  assert.equal(signupDestination('CUSTOMER', '//attacker.example'), '/');
});

test('OAuth callback origin is canonical and cannot contain credentials, scripts or redirect paths', () => {
  assert.equal(applicationOrigin({ APP_URL: 'http://localhost:3000' }), 'http://localhost:3000');
  assert.equal(
    applicationOrigin({ APP_URL: 'https://fixflow.example' }),
    'https://fixflow.example',
  );
  assert.equal(
    applicationOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'fixflow.vercel.app' }),
    'https://fixflow.vercel.app',
  );
  for (const value of [
    'javascript:alert(1)',
    'https://user:secret@fixflow.example',
    'https://fixflow.example/callback',
    'http://attacker.example',
    'https://fixflow.example?next=//attacker.example',
  ])
    assert.throws(() => applicationOrigin({ APP_URL: value }));
});

test('image processing decodes real images and rejects oversized, fake, or executable content', async () => {
  const png = await sharp({
    create: { width: 800, height: 600, channels: 3, background: '#125cff' },
  })
    .png()
    .toBuffer();
  const output = await prepareImage(
    new File([new Uint8Array(png)], 'photo.png', { type: 'image/png' }),
    'AVATAR',
  );
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.exif, undefined);
  await assert.rejects(
    prepareImage(
      new File(['<svg onload="alert(1)"></svg>'], 'photo.svg', { type: 'image/svg+xml' }),
      'AVATAR',
    ),
  );
  await assert.rejects(
    prepareImage(new File(['not an image'], 'fake.png', { type: 'image/png' }), 'PORTFOLIO'),
  );
  await assert.rejects(
    prepareImage(
      new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' }),
      'PORTFOLIO',
    ),
  );
});

test('image paths stay inside their owner folder and cannot become external avatar URLs', () => {
  const path = '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.webp';
  assert.equal(validImagePath(path, '00000000-0000-4000-8000-000000000001'), true);
  assert.equal(validImagePath(path, '00000000-0000-4000-8000-000000000003'), false);
  assert.equal(validImagePath('../someone/photo.webp'), false);
  assert.equal(avatarUrl('https://attacker.example/image.png'), null);
});

test('verified roles get their own destination and navigation', () => {
  assert.equal(loginDestination('ADMIN'), '/admin');
  assert.equal(loginDestination('CUSTOMER'), '/');
  assert.equal(loginDestination('TECHNICIAN'), '/technician');
  assert.deepEqual(mainNavigation('ADMIN'), [
    { href: '/', label: 'ค้นหาช่าง' },
    { href: '/admin', label: 'แดชบอร์ดจัดการระบบ' },
  ]);
  assert.deepEqual(
    mainNavigation('CUSTOMER').map((item) => item.href),
    ['/', '/bookings'],
  );
  assert.ok(!mainNavigation('ADMIN').some((item) => item.href === '/bookings'));
  assert.deepEqual(mainNavigation('TECHNICIAN'), [
    { href: '/', label: 'ค้นหาช่าง' },
    { href: '/technician', label: 'งานของฉัน' },
  ]);
});

test('technicians cannot create customer bookings, including direct requests', async () => {
  await assert.rejects(
    bookJob({ id: 'tech', role: 'TECHNICIAN', active: true }, {}),
    /เฉพาะบัญชีลูกค้า/,
  );
});

test('profile validation accepts only editable fields and validates phone and name', () => {
  assert.deepEqual(
    accountProfileSchema.parse({
      name: ' ชื่อใหม่ ',
      phone: '0800000000',
      role: 'ADMIN',
      active: false,
      id: 'other',
    }),
    { name: 'ชื่อใหม่', phone: '0800000000' },
  );
  assert.equal(accountProfileSchema.safeParse({ name: 'ชื่อ', phone: '' }).success, true);
  for (const input of [
    { name: ' ', phone: '' },
    { name: 'ชื่อ', phone: '123' },
    { name: 'ชื่อ', phone: '1800000000' },
  ])
    assert.equal(accountProfileSchema.safeParse(input).success, false);
});

test('multipart uploads enforce origin and streaming size limits before parsing', async () => {
  const url = 'http://localhost:3000/api/account';
  assert.equal(
    sameOrigin(new Request(url, { headers: { origin: 'http://localhost:3000' } })),
    true,
  );
  assert.equal(
    sameOrigin(new Request(url, { headers: { origin: 'https://other.example' } })),
    false,
  );
  assert.equal(sameOrigin(new Request(url)), false);
  const data = new FormData();
  data.set('name', 'ชื่อทดสอบ');
  data.set('phone', '');
  const parsed = await limitedImageForm(new Request(url, { method: 'POST', body: data }));
  assert.equal(parsed.get('name'), 'ชื่อทดสอบ');
  await assert.rejects(
    limitedImageForm(
      new Request(url, { method: 'POST', body: new Uint8Array(3 * 1024 * 1024 + 1) }),
    ),
    /ใหญ่เกินไป/,
  );
  await assert.rejects(limitedImageForm(new Request(url)), /ไม่พบข้อมูล/);
});

test('technician acting as a customer cannot advance their own order or manage another technician job', () => {
  const actor = { id: 'buyer-tech', role: 'TECHNICIAN' as const };
  const ownPurchase = { customerId: actor.id, technician: { userId: 'other-tech' } };
  assert.equal(roleForBooking(actor, ownPurchase), 'CUSTOMER');
  assert.equal(canTransition('PENDING', 'ACCEPTED', roleForBooking(actor, ownPurchase)!), false);
  assert.equal(
    roleForBooking(actor, { customerId: 'other-buyer', technician: { userId: 'other-tech' } }),
    null,
  );
  assert.equal(
    roleForBooking(actor, { customerId: 'other-buyer', technician: { userId: actor.id } }),
    'TECHNICIAN',
  );
  assert.equal(roleForBooking({ id: 'admin', role: 'ADMIN' }, ownPurchase), 'ADMIN');
  assert.equal(
    roleForBooking(
      { id: actor.id, role: 'CUSTOMER' },
      { customerId: 'other-buyer', technician: { userId: actor.id } },
    ),
    null,
  );
});

test('technician application strips privilege fields and rejects incomplete areas and schedule', () => {
  const input = {
    name: 'ช่างทดสอบ',
    phone: '0800000000',
    category: 'AIRCON',
    description: 'บริการทดสอบ',
    price: '500',
    experience: '2',
    districtIds: ['1001'],
    workDays: ['1'],
    availableTimes: ['09:00'],
    role: 'ADMIN',
    active: true,
    userId: 'victim',
    portfolioPaths: [
      '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.webp',
    ],
  };
  const result = technicianApplicationSchema.parse(input);
  assert.equal('role' in result, false);
  assert.equal('active' in result, false);
  assert.equal('userId' in result, false);
  assert.equal(
    technicianApplicationSchema.safeParse({ ...input, portfolioPaths: [] }).success,
    false,
  );
  assert.equal(
    technicianApplicationSchema.safeParse({ ...input, portfolioUrl: 'javascript:alert(1)' })
      .success,
    false,
  );
  assert.equal(technicianApplicationSchema.safeParse({ ...input, districtIds: [] }).success, false);
  assert.equal(
    technicianApplicationSchema.safeParse({ ...input, availableTimes: ['03:00'] }).success,
    false,
  );
});

test('prices are calculated from service, technician minimum, and travel fee', () => {
  assert.deepEqual(quote(500, 700, 100), { price: 700, travelFee: 100, totalAmount: 800 });
  assert.deepEqual(quote(900, 500, 0), { price: 900, travelFee: 0, totalAmount: 900 });
});
test('appointment validation checks Bangkok timezone, invalid dates, past and horizon', () => {
  const now = new Date('2026-10-13T12:00:00+07:00');
  assert.equal(validateAppointment('2026-10-14', '09:00', 30, now), null);
  assert.ok(validateAppointment('2026-10-13', '09:00', 30, now));
  assert.ok(validateAppointment('2026-02-30', '09:00', 30, now));
  assert.ok(validateAppointment('2027-01-15', '09:00', 30, now));
  assert.equal(bangkokDate(new Date('2026-10-13T18:00:00Z')), '2026-10-14');
});
test('server strips client-provided prices and rejects malformed inputs', () => {
  const data = {
    technicianId: 'a',
    serviceId: 's',
    districtId: '1001',
    customerName: 'ลูกค้า',
    phone: '0800000000',
    address: 'ที่อยู่สำหรับทดสอบ',
    details: '',
    date: '2026-10-20',
    time: '09:00',
    price: 1,
    totalAmount: 1,
  };
  const result = bookingSchema.parse(data);
  assert.ok(!('price' in result));
  assert.equal(bookingSchema.safeParse({ ...data, phone: '1234' }).success, false);
  assert.equal(bookingSchema.safeParse({ ...data, time: '10:00' }).success, false);
});
test('customers cannot update technician states; workflow cannot skip or roll back', () => {
  assert.equal(canTransition('PENDING', 'ACCEPTED', 'TECHNICIAN'), true);
  assert.equal(canTransition('IN_PROGRESS', 'AWAITING_PAYMENT', 'ADMIN'), true);
  assert.equal(canTransition('PENDING', 'ACCEPTED', 'CUSTOMER'), false);
  assert.equal(canTransition('PENDING', 'COMPLETED', 'ADMIN'), false);
  assert.equal(canTransition('COMPLETED', 'IN_PROGRESS', 'TECHNICIAN'), false);
});
test('redirect destinations cannot be external, protocol-relative, or script URLs', () => {
  assert.equal(safeNext('https://example.com'), '/bookings');
  assert.equal(safeNext('//example.com'), '/bookings');
  assert.equal(safeNext('/\\example.com'), '/bookings');
  assert.equal(safeNext('javascript:alert(1)'), '/bookings');
  assert.equal(safeNext('/admin/settings'), '/admin/settings');
  assert.equal(safeNext('/'), '/');
});
test('demo authentication cannot be activated in production or against cloud data', () => {
  const names = [
    'NODE_ENV',
    'VERCEL',
    'DEMO_AUTH',
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    Object.assign(process.env, {
      NODE_ENV: 'development',
      DEMO_AUTH: 'true',
      DATABASE_URL: 'postgresql://localhost:51214/test',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    });
    delete process.env.VERCEL;
    assert.equal(isDemoMode(), true);
    Object.assign(process.env, { NODE_ENV: 'production' });
    assert.equal(isDemoMode(), false);
    Object.assign(process.env, { NODE_ENV: 'development' });
    process.env.DATABASE_URL = 'postgresql://cloud.example.com/test';
    assert.equal(isDemoMode(), false);
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.VERCEL = '1';
    assert.equal(isDemoMode(), false);
    delete process.env.VERCEL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test';
    assert.equal(isDemoMode(), false);
  } finally {
    for (const [name, value] of Object.entries(previous))
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  }
});
