import { PrismaClient } from '@prisma/client';
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error('ใช้คำสั่ง npm run admin:grant -- EMAIL ของบัญชีที่ยืนยันแล้ว');
const prisma = new PrismaClient();
try {
  const user = await prisma.appUser.findUnique({ where: { email } });
  if (!user) throw new Error('ไม่พบบัญชี กรุณาเข้าสู่ระบบและยืนยัน OTP ให้สำเร็จก่อน');
  await prisma.appUser.update({ where: { id: user.id }, data: { role: 'ADMIN', active: true } });
  console.log('กำหนดบัญชีเป็น Admin แล้ว ออกจากระบบและเข้าสู่ระบบใหม่เพื่อเริ่มใช้งาน');
} finally {
  await prisma.$disconnect();
}
