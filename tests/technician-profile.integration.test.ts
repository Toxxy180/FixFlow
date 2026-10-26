import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { updateTechnicianProfile } from '../src/lib/technician-profile';

test('technicians edit only their approved work profile; moderation, evidence and existing bookings are preserved', async () => {
  const ownerId = randomUUID();
  const otherId = randomUUID();
  const rollback = new Error('ROLLBACK_TECHNICIAN_PROFILE');
  try {
    await assert.rejects(
      prisma.$transaction(
        async (tx) => {
          const [category, districts, service] = await Promise.all([
            tx.serviceCategory.findFirstOrThrow({ where: { active: true } }),
            tx.district.findMany({ take: 2, orderBy: { id: 'asc' } }),
            tx.service.findFirstOrThrow(),
          ]);
          assert.equal(districts.length, 2);
          await tx.appUser.createMany({
            data: [
              {
                id: ownerId,
                email: `${ownerId}@test.example`,
                name: 'ชื่อบัญชีคงเดิม',
                role: 'TECHNICIAN',
              },
              {
                id: otherId,
                email: `${otherId}@test.example`,
                name: 'ช่างอีกคน',
                role: 'TECHNICIAN',
              },
            ],
          });
          const evidence = `${ownerId}/${randomUUID()}.webp`;
          const reviewedAt = new Date('2026-10-01T00:00:00Z');
          const tech = await tx.technician.create({
            data: {
              name: 'ข้อมูลรับงานเดิม',
              initials: 'เด',
              category: category.id,
              description: 'รายละเอียดเดิม',
              district: districts[0].name,
              price: 500,
              userId: ownerId,
              active: false,
              applicationStatus: 'APPROVED',
              applicationReviewedAt: reviewedAt,
              applicationReviewNote: 'บันทึกจาก Admin',
              portfolioPaths: [evidence],
              areas: { create: { districtId: districts[0].id } },
            },
          });
          const other = await tx.technician.create({
            data: {
              name: 'ช่างอีกคนห้ามเปลี่ยน',
              initials: 'อี',
              category: category.id,
              description: 'ข้อมูลอีกคน',
              district: districts[0].name,
              price: 400,
              userId: otherId,
              applicationStatus: 'APPROVED',
            },
          });
          const booking = await tx.booking.create({
            data: {
              reference: `QA-${randomUUID()}`,
              customerId: otherId,
              customerName: 'ลูกค้าเดิม',
              phone: '0800000000',
              address: 'ที่อยู่ทดสอบ',
              districtId: districts[0].id,
              details: 'งานเดิมที่ต้องคงอยู่',
              date: '2099-01-01',
              time: '09:00',
              technicianId: tech.id,
              serviceId: service.id,
              serviceName: 'บริการเดิม',
              price: 500,
              travelFee: 100,
              totalAmount: 600,
            },
          });
          const input = {
            name: ' ช่างแก้ไขบริการแล้ว ',
            category: category.id,
            description: 'บริการใหม่และรายละเอียดที่แก้ไข',
            price: '1250',
            experience: '7',
            districtIds: [districts[1].id],
            workDays: ['1', '3'],
            availableTimes: ['11:00'],
            portfolioUrl: 'https://example.com/portfolio',
          };
          for (const extra of [
            { id: other.id },
            { userId: otherId },
            { role: 'ADMIN' },
            { active: true },
            { applicationStatus: 'APPROVED' },
          ])
            await assert.rejects(updateTechnicianProfile(tx, ownerId, { ...input, ...extra }));
          await assert.rejects(updateTechnicianProfile(tx, ownerId, { ...input, districtIds: [] }));
          await assert.rejects(
            updateTechnicianProfile(tx, ownerId, { ...input, districtIds: ['1099'] }),
          );
          await assert.rejects(
            updateTechnicianProfile(tx, ownerId, { ...input, availableTimes: ['03:00'] }),
          );
          await assert.rejects(
            updateTechnicianProfile(tx, ownerId, { ...input, portfolioUrl: 'javascript:alert(1)' }),
          );
          const id = await updateTechnicianProfile(tx, ownerId, input);
          assert.equal(id, tech.id);
          const saved = await tx.technician.findUniqueOrThrow({
            where: { id },
            include: { areas: true },
          });
          assert.equal(saved.name, 'ช่างแก้ไขบริการแล้ว');
          assert.equal(saved.price, 1250);
          assert.equal(saved.experience, 7);
          assert.deepEqual(saved.workDays, [1, 3]);
          assert.deepEqual(saved.availableTimes, ['11:00']);
          assert.deepEqual(
            saved.areas.map((area) => area.districtId),
            [districts[1].id],
          );
          assert.equal(saved.portfolioUrl, input.portfolioUrl);
          assert.equal(saved.active, false, 'cannot reopen a profile paused by Admin');
          assert.equal(saved.applicationStatus, 'APPROVED');
          assert.equal(saved.applicationReviewedAt?.toISOString(), reviewedAt.toISOString());
          assert.equal(saved.applicationReviewNote, 'บันทึกจาก Admin');
          assert.deepEqual(saved.portfolioPaths, [evidence]);
          assert.equal(
            (await tx.appUser.findUniqueOrThrow({ where: { id: ownerId } })).name,
            'ชื่อบัญชีคงเดิม',
          );
          assert.equal(
            (await tx.technician.findUniqueOrThrow({ where: { id: other.id } })).name,
            other.name,
          );
          assert.deepEqual(
            await tx.booking.findUniqueOrThrow({ where: { id: booking.id } }),
            booking,
          );
          assert.equal(
            await tx.auditLog.count({
              where: { actorId: ownerId, action: 'UPDATE_OWN_TECHNICIAN', targetId: id },
            }),
            1,
          );
          for (const status of ['PENDING', 'REJECTED'] as const) {
            await tx.technician.update({ where: { id }, data: { applicationStatus: status } });
            await assert.rejects(updateTechnicianProfile(tx, ownerId, input), /อนุมัติ/);
          }
          await tx.technician.update({ where: { id }, data: { applicationStatus: 'APPROVED' } });
          for (const role of ['CUSTOMER', 'ADMIN'] as const) {
            await tx.appUser.update({ where: { id: ownerId }, data: { role } });
            await assert.rejects(updateTechnicianProfile(tx, ownerId, input), /เฉพาะบัญชีช่าง/);
          }
          await tx.appUser.update({
            where: { id: ownerId },
            data: { role: 'TECHNICIAN', suspendedUntil: new Date('2099-01-01') },
          });
          await assert.rejects(updateTechnicianProfile(tx, ownerId, input), /เปิดใช้งาน/);
          await tx.appUser.update({
            where: { id: ownerId },
            data: { suspendedUntil: null, active: false },
          });
          await assert.rejects(updateTechnicianProfile(tx, ownerId, input), /เปิดใช้งาน/);
          throw rollback;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
      ),
      (error) => error === rollback,
    );
    assert.equal(await prisma.appUser.findUnique({ where: { id: ownerId } }), null);
  } finally {
    await prisma.$disconnect();
  }
});
