import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { updateManagedUser } from '../src/lib/user-management';

test('account updates preserve applications and photos, pause technicians and require approval', async () => {
  const id = randomUUID();
  const actor = { id: randomUUID(), role: 'ADMIN' as const, active: true };
  const rollback = new Error('ROLLBACK_TEST_FIXTURE');
  try {
    await assert.rejects(
      prisma.$transaction(
        async (tx) => {
          const category = await tx.serviceCategory.findFirstOrThrow();
          const portfolioPath = `${id}/${randomUUID()}.webp`;
          await tx.appUser.create({
            data: { id, email: `${id}@test.example`, name: 'ทดสอบบัญชีแบบ rollback' },
          });
          const technician = await tx.technician.create({
            data: {
              name: 'ใบสมัครทดสอบแบบ rollback',
              initials: 'ทด',
              category: category.id,
              district: 'พระนคร',
              description: 'ข้อมูลทดสอบที่ไม่บันทึกถาวร',
              price: 500,
              active: false,
              userId: id,
              applicationStatus: 'PENDING',
              portfolioPaths: [portfolioPath],
            },
          });
          const application = () =>
            tx.technician.findUniqueOrThrow({ where: { id: technician.id } });
          const unchangedCustomer = { id, role: 'CUSTOMER' as const, active: true };
          for (const status of ['NONE', 'REJECTED', 'PENDING'] as const) {
            await tx.technician.update({
              where: { id: technician.id },
              data: { applicationStatus: status },
            });
            await updateManagedUser(tx, actor, unchangedCustomer);
            assert.equal(
              (await application()).userId,
              id,
              'saving a customer must retain their application',
            );
            assert.equal((await application()).applicationStatus, status);
            assert.deepEqual((await application()).portfolioPaths, [portfolioPath]);
          }
          await assert.rejects(
            updateManagedUser(tx, actor, { ...unchangedCustomer, role: 'TECHNICIAN' }),
            /อนุมัติใบสมัคร/,
          );
          await updateManagedUser(tx, actor, { ...unchangedCustomer, active: false });
          await updateManagedUser(tx, actor, unchangedCustomer);
          assert.equal((await application()).applicationStatus, 'PENDING');
          assert.equal((await application()).userId, id);
          await tx.appUser.update({ where: { id }, data: { role: 'TECHNICIAN' } });
          await tx.technician.update({
            where: { id: technician.id },
            data: { applicationStatus: 'APPROVED', active: true },
          });
          const approvedTechnician = { id, role: 'TECHNICIAN' as const, active: true };
          const service = await tx.service.findFirstOrThrow();
          const district = await tx.district.findFirstOrThrow();
          const job = await tx.booking.create({
            data: {
              reference: `QA-${randomUUID()}`,
              customerId: id,
              customerName: 'ทดสอบแบบ rollback',
              phone: '0800000000',
              address: 'ที่อยู่จำลองสำหรับทดสอบ',
              districtId: district.id,
              details: '',
              date: '2099-01-01',
              time: '09:00',
              serviceId: service.id,
              serviceName: service.name,
              price: 500,
              totalAmount: 500,
              technicianId: technician.id,
            },
          });
          await assert.rejects(
            updateManagedUser(tx, actor, { ...approvedTechnician, active: false }),
            /ช่างมีงานค้าง/,
          );
          await assert.rejects(updateManagedUser(tx, actor, unchangedCustomer), /ผู้ใช้มีงานค้าง/);
          assert.equal((await application()).active, true);
          await tx.booking.update({ where: { id: job.id }, data: { status: 'CANCELLED' } });
          await updateManagedUser(tx, actor, { ...approvedTechnician, active: false });
          assert.equal((await application()).active, false);
          assert.equal(
            (await application()).userId,
            id,
            'suspension must retain technician ownership',
          );
          await updateManagedUser(tx, actor, approvedTechnician);
          assert.equal(
            (await application()).active,
            false,
            'reactivation must not reopen work automatically',
          );
          assert.equal((await application()).applicationStatus, 'APPROVED');
          await updateManagedUser(tx, actor, unchangedCustomer);
          assert.equal(
            (await application()).userId,
            id,
            'role changes must preserve historical ownership',
          );
          assert.deepEqual((await application()).portfolioPaths, [portfolioPath]);
          await assert.rejects(
            updateManagedUser(tx, { ...actor, role: 'CUSTOMER' }, approvedTechnician),
            /ไม่มีสิทธิ์/,
          );
          await assert.rejects(
            updateManagedUser(tx, { ...actor, id }, unchangedCustomer),
            /ตัวเอง/,
          );
          throw rollback;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
      ),
      (error: unknown) => error === rollback,
    );
    assert.equal(await prisma.appUser.findUnique({ where: { id } }), null);
    assert.equal(await prisma.technician.count({ where: { userId: id } }), 0);
  } finally {
    await prisma.$disconnect();
  }
});
