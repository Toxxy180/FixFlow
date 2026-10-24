import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma';
import {
  bookJob,
  cancelJob,
  advanceJob,
  addJobPart,
  removeJobPart,
  payDemoJob,
  reviewJob,
} from '../src/lib/booking-service';
import { bangkokDate } from '../src/lib/constants';

test('PostgreSQL app tables have RLS enabled (read-only security metadata check)', async () => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL || '').hostname));
  const expected = [
    'AppUser',
    'District',
    'ServiceCategory',
    'Service',
    'Technician',
    'TechnicianDistrict',
    'Booking',
    'Slot',
    'JobStatusHistory',
    'JobPartItem',
    'Payment',
    'Review',
    'AppSetting',
    'RateLimit',
    'AuditLog',
    'UserImage',
  ];
  const rows = await prisma.$queryRaw<{ name: string; enabled: boolean }[]>`
    SELECT c.relname AS name, c.relrowsecurity AS enabled
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'`;
  for (const name of expected)
    assert.equal(rows.find((row) => row.name === name)?.enabled, true, name);
});

test('PostgreSQL: authorization, immutable prices, unique slots, cancellation, parts, payment, review', async () => {
  const host = new URL(process.env.DATABASE_URL || '').hostname;
  assert.ok(
    ['localhost', '127.0.0.1'].includes(host),
    'Integration test only runs against a local database',
  );
  const fixture = `qa-${randomUUID()}`;
  const customer = { id: randomUUID(), role: 'CUSTOMER' as const, active: true };
  const stranger = { id: randomUUID(), role: 'CUSTOMER' as const, active: true };
  const techUser = { id: randomUUID(), role: 'TECHNICIAN' as const, active: true };
  const serviceId = `${fixture}-service`,
    technicianId = `${fixture}-tech`;
  try {
    for (const actor of [customer, stranger, techUser])
      await prisma.appUser.create({
        data: { ...actor, email: `${actor.id}@test.example`, name: 'ผู้ทดสอบอัตโนมัติ' },
      });
    await prisma.service.create({
      data: { id: serviceId, name: 'บริการทดสอบ', categoryId: 'AIRCON', price: 1200 },
    });
    await prisma.technician.create({
      data: {
        id: technicianId,
        name: 'ช่างทดสอบ',
        initials: 'ทด',
        category: 'AIRCON',
        district: 'พระนคร',
        description: 'ข้อมูลทดสอบที่ล้างหลังจบ',
        price: 900,
        color: 'blue',
        userId: techUser.id,
        workDays: [0, 1, 2, 3, 4, 5, 6],
        areas: { create: { districtId: '1001' } },
      },
    });
    const data = {
      technicianId,
      serviceId,
      districtId: '1001',
      customerName: 'ลูกค้าทดสอบ',
      phone: '0800000000',
      address: 'ที่อยู่จำลองสำหรับทดสอบ',
      details: '',
      date: bangkokDate(new Date(Date.now() + 3 * 86400000)),
      time: '09:00',
      price: 1,
      totalAmount: 1,
    };
    await assert.rejects(bookJob(customer, { ...data, districtId: '9999' }));
    const first = await bookJob(customer, data);
    let booking = await prisma.booking.findUniqueOrThrow({
      where: { id: first.id },
      include: { payment: true },
    });
    assert.equal(booking.price, 1200);
    assert.equal(booking.payment?.amount, booking.totalAmount);
    await assert.rejects(bookJob(customer, data));
    await assert.rejects(cancelJob(stranger, first.id));
    await assert.rejects(advanceJob(customer, first.id, 'ACCEPTED'));
    await assert.rejects(reviewJob(customer, first.id, 5, ''));
    await prisma.service.update({ where: { id: serviceId }, data: { price: 2000 } });
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: first.id } })).price, 1200);
    await cancelJob(customer, first.id);
    assert.equal(await prisma.slot.count({ where: { bookingId: first.id } }), 0);
    const second = await bookJob(customer, data);
    await advanceJob(techUser, second.id, 'ACCEPTED');
    await assert.rejects(advanceJob(techUser, second.id, 'AWAITING_PAYMENT'));
    await advanceJob(techUser, second.id, 'ON_THE_WAY');
    await advanceJob(techUser, second.id, 'IN_PROGRESS');
    await addJobPart(techUser, second.id, 'น้ำยาแอร์', 2, 150);
    let part = await prisma.jobPartItem.findFirstOrThrow({ where: { bookingId: second.id } });
    await assert.rejects(removeJobPart(stranger, second.id, part.id));
    await removeJobPart(techUser, second.id, part.id);
    await addJobPart(techUser, second.id, 'น้ำยาแอร์', 2, 150);
    booking = await prisma.booking.findUniqueOrThrow({
      where: { id: second.id },
      include: { payment: true },
    });
    assert.equal(booking.totalAmount, booking.price + booking.travelFee + 300);
    assert.equal(booking.payment?.amount, booking.totalAmount);
    await advanceJob(techUser, second.id, 'AWAITING_PAYMENT');
    await assert.rejects(addJobPart(techUser, second.id, 'แอบเพิ่ม', 1, 1));
    await assert.rejects(payDemoJob(stranger, second.id));
    await payDemoJob(customer, second.id);
    await assert.rejects(payDemoJob(customer, second.id));
    await reviewJob(customer, second.id, 5, 'ทดสอบครบขั้นตอน');
    await assert.rejects(reviewJob(customer, second.id, 4, 'ซ้ำ'));
    assert.equal(
      (await prisma.booking.findUniqueOrThrow({ where: { id: second.id } })).status,
      'COMPLETED',
    );
    assert.equal(await prisma.jobStatusHistory.count({ where: { bookingId: second.id } }), 6);
    const competing = await Promise.allSettled([
      bookJob(customer, { ...data, time: '11:00' }),
      bookJob(stranger, { ...data, time: '11:00' }),
    ]);
    assert.equal(competing.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      await prisma.slot.count({ where: { technicianId, date: data.date, time: '11:00' } }),
      1,
    );
  } finally {
    await prisma.review.deleteMany({ where: { technicianId } });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [customer.id, stranger.id, techUser.id] } },
    });
    await prisma.booking.deleteMany({ where: { technicianId } });
    await prisma.technician.deleteMany({ where: { id: technicianId } });
    await prisma.service.deleteMany({ where: { id: serviceId } });
    await prisma.appUser.deleteMany({
      where: { id: { in: [customer.id, stranger.id, techUser.id] } },
    });
    await prisma.$disconnect();
  }
});
