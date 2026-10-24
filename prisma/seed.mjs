import { PrismaClient } from '@prisma/client';
import { districts } from './districts.mjs';
const prisma = new PrismaClient();
const technicians = [
  {
    id: 'tech-aek',
    name: 'ช่างเอก',
    initials: 'เอ',
    category: 'AIRCON',
    district: 'ลาดพร้าว',
    description: 'ล้างแอร์ ติดตั้ง และซ่อมเครื่องปรับอากาศ',
    price: 500,
    color: 'blue',
  },
  {
    id: 'tech-ton',
    name: 'ช่างต้น',
    initials: 'ต้',
    category: 'ELECTRIC',
    district: 'จตุจักร',
    description: 'แก้ไฟดับ เปลี่ยนปลั๊ก และติดตั้งระบบไฟ',
    price: 350,
    color: 'amber',
  },
  {
    id: 'tech-boy',
    name: 'ช่างบอย',
    initials: 'บอ',
    category: 'PLUMBING',
    district: 'บางกะปิ',
    description: 'ซ่อมท่อรั่ว แก้ท่อตัน และเปลี่ยนสุขภัณฑ์',
    price: 400,
    color: 'teal',
  },
  {
    id: 'tech-nat',
    name: 'ช่างนัท',
    initials: 'นั',
    category: 'GENERAL',
    district: 'ลาดพร้าว',
    description: 'ประกอบเฟอร์นิเจอร์ ติดชั้น และซ่อมงานบ้าน',
    price: 300,
    color: 'purple',
  },
  {
    id: 'tech-moss',
    name: 'ช่างมอส',
    initials: 'มอ',
    category: 'AIRCON',
    district: 'ห้วยขวาง',
    description: 'ล้างแอร์ เติมน้ำยา และตรวจเช็กความเย็น',
    price: 550,
    color: 'blue',
  },
  {
    id: 'tech-joe',
    name: 'ช่างโจ',
    initials: 'โจ',
    category: 'ELECTRIC',
    district: 'บางเขน',
    description: 'ติดตั้งโคมไฟ เดินสาย และตรวจระบบไฟฟ้า',
    price: 400,
    color: 'amber',
  },
];
try {
  console.log('กำลังเตรียมข้อมูลเริ่มต้น กรุณารอจนแสดงข้อความสำเร็จ...');
  const categories = [
    ['AIRCON', 'ช่างแอร์'],
    ['ELECTRIC', 'ช่างไฟฟ้า'],
    ['PLUMBING', 'ช่างประปา'],
    ['GENERAL', 'ช่างทั่วไป'],
  ].map(([id, name]) => ({ id, name }));
  const services = [
    ['service-air-clean', 'ล้างแอร์', 'AIRCON', 500],
    ['service-air-repair', 'ตรวจและซ่อมแอร์', 'AIRCON', 700],
    ['service-electric', 'ซ่อมระบบไฟฟ้า', 'ELECTRIC', 350],
    ['service-plumb', 'ซ่อมประปา', 'PLUMBING', 400],
    ['service-general', 'ซ่อมงานบ้านทั่วไป', 'GENERAL', 300],
  ].map(([id, name, categoryId, price]) => ({ id, name, categoryId, price }));
  // Commit all defaults together. Bulk inserts avoid hundreds of network round trips.
  // skipDuplicates preserves data already edited by an administrator.
  await prisma.$transaction(
    async (tx) => {
      await tx.district.createMany({ data: districts, skipDuplicates: true });
      await tx.serviceCategory.createMany({ data: categories, skipDuplicates: true });
      await tx.service.createMany({ data: services, skipDuplicates: true });
      await tx.appSetting.createMany({ data: [{ id: 'main' }], skipDuplicates: true });
      const existing = await tx.technician.findMany({
        where: { id: { in: technicians.map((t) => t.id) } },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((t) => t.id));
      const newTechnicians = technicians.filter((t) => !existingIds.has(t.id));
      await tx.technician.createMany({
        data: newTechnicians.map((t) => ({ ...t, experience: 5 })),
        skipDuplicates: true,
      });
      if (newTechnicians.length) {
        await tx.technicianDistrict.createMany({
          data: newTechnicians.flatMap((t) =>
            districts.map((d) => ({ technicianId: t.id, districtId: d.id })),
          ),
          skipDuplicates: true,
        });
      }
    },
    { isolationLevel: 'Serializable', maxWait: 15000, timeout: 60000 },
  );
  console.log(
    'สำเร็จ: ข้อมูลตั้งต้นครบ 50 เขต, 4 หมวดหมู่, 5 บริการ, ช่างตัวอย่าง 6 คน และค่าตั้งค่าหลัก',
  );
} finally {
  await prisma.$disconnect();
}
