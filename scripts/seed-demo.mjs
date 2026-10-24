import { PrismaClient } from '@prisma/client';
process.loadEnvFile('.env');
const prisma = new PrismaClient();
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || process.env.NEXT_PUBLIC_SUPABASE_URL)
  throw new Error('ห้ามสร้างบัญชีสาธิตบนฐานข้อมูลออนไลน์');
try {
  for (const [id, email, name, role] of [
    ['00000000-0000-4000-8000-000000000001', 'customer@fixflow.example', 'ลูกค้าทดลอง', 'CUSTOMER'],
    ['00000000-0000-4000-8000-000000000002', 'technician@fixflow.example', 'ช่างเอก', 'TECHNICIAN'],
    ['00000000-0000-4000-8000-000000000003', 'admin@fixflow.example', 'ผู้ดูแลระบบ', 'ADMIN'],
  ])
    await prisma.appUser.upsert({ where: { id }, update: {}, create: { id, email, name, role } });
  await prisma.technician.update({
    where: { id: 'tech-aek' },
    data: { userId: '00000000-0000-4000-8000-000000000002' },
  });
  console.log('สร้างบัญชีสาธิต 3 บทบาทสำหรับฐานข้อมูลในเครื่องแล้ว');
} finally {
  await prisma.$disconnect();
}
