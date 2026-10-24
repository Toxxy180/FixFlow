import { PrismaClient } from '@prisma/client';
const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];
let failed = false;
for (const name of required)
  if (!process.env[name] || /USER:PASSWORD|POOLER_HOST/.test(process.env[name])) {
    console.error(`ยังไม่ได้ตั้งค่า ${name}`);
    failed = true;
  }
if (process.env.DEMO_AUTH === 'true') {
  console.error('ตั้ง DEMO_AUTH=false ก่อน deploy');
  failed = true;
}
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
let secretKey = key.startsWith('sb_secret_');
try {
  secretKey ||=
    JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role ===
    'service_role';
} catch {}
if (secretKey) {
  console.error('ห้ามใช้ secret/service_role key ใน NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  failed = true;
}
try {
  const url = new URL(process.env.DATABASE_URL || '');
  if (['localhost', '127.0.0.1'].includes(url.hostname)) {
    console.error('DATABASE_URL ยังเป็นฐานข้อมูลในเครื่อง');
    failed = true;
  }
  if (url.searchParams.get('sslmode') !== 'require') {
    console.error('ตั้ง sslmode=require สำหรับ Supabase');
    failed = true;
  }
} catch {
  console.error('DATABASE_URL ไม่ถูกต้อง');
  failed = true;
}
if (failed) process.exit(1);
const prisma = new PrismaClient();
try {
  const roles =
    await prisma.$queryRaw`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  if (roles[0]?.rolsuper || roles[0]?.rolbypassrls)
    throw new Error(
      'DATABASE_URL ต้องใช้ runtime role ที่ไม่มี superuser/bypassrls ตาม docs/DEPLOY.md',
    );
  const [districts, setting] = await Promise.all([
    prisma.district.count(),
    prisma.appSetting.findUnique({ where: { id: 'main' } }),
  ]);
  if (districts !== 50 || !setting) throw new Error('กรุณารัน migration และ seed ให้ครบก่อน');
  console.log('พร้อมตรวจ deploy: config ครบ เชื่อม PostgreSQL ได้ ใช้ runtime role และมี 50 เขต');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'ตรวจการเชื่อมต่อไม่สำเร็จ');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
