import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { updateManagedUser } from '../src/lib/user-management';
import { accountStatus, activeAccountWhere } from '../src/lib/account-status';

test('account status controls preserve roles, applications, photos and jobs; expiry restores access', async () => {
  const id = randomUUID();
  const adminId = randomUUID();
  const actor = { id: randomUUID(), role: 'ADMIN' as const, active: true };
  const rollback = new Error('ROLLBACK_TEST_FIXTURE');
  try {
    await assert.rejects(
      prisma.$transaction(
        async (tx) => {
          const category = await tx.serviceCategory.findFirstOrThrow();
          const email = `${id}@test.example`;
          await tx.appUser.create({ data: { id, email, name: 'บัญชีทดสอบแบบ rollback' } });
          await tx.appUser.create({
            data: {
              id: adminId,
              email: `${adminId}@test.example`,
              name: 'Admin ทดสอบ',
              role: 'ADMIN',
            },
          });
          const path = `${id}/${randomUUID()}.webp`;
          const tech = await tx.technician.create({
            data: {
              name: 'ช่างทดสอบ rollback',
              initials: 'ทด',
              category: category.id,
              district: 'พระนคร',
              description: 'ข้อมูลจำลอง',
              price: 500,
              active: false,
              userId: id,
              applicationStatus: 'PENDING',
              portfolioPaths: [path],
            },
          });
          await updateManagedUser(tx, actor, { id, status: 'DISABLED', reason: 'ทดสอบปิดบัญชี' });
          assert.equal((await tx.appUser.findUniqueOrThrow({ where: { id } })).role, 'CUSTOMER');
          await updateManagedUser(tx, actor, { id, status: 'ACTIVE' });
          assert.equal(
            (await tx.technician.findUniqueOrThrow({ where: { id: tech.id } })).active,
            false,
            'activation never approves a pending application',
          );
          await assert.rejects(
            updateManagedUser(tx, actor, { id, status: 'ACTIVE', role: 'ADMIN' } as never),
          );
          await assert.rejects(
            updateManagedUser(tx, actor, {
              id: adminId,
              status: 'DISABLED',
              reason: 'ทดสอบป้องกัน Admin',
            }),
            /Admin/,
          );
          await assert.rejects(
            updateManagedUser(tx, actor, { id: actor.id, status: 'DISABLED', reason: 'ทดสอบ' }),
            /ตัวเอง/,
          );
          await assert.rejects(
            updateManagedUser(tx, { ...actor, role: 'CUSTOMER' }, { id, status: 'ACTIVE' }),
            /ไม่มีสิทธิ์/,
          );
          await assert.rejects(
            updateManagedUser(
              tx,
              { ...actor, suspendedUntil: new Date('2099-01-01') },
              { id, status: 'ACTIVE' },
            ),
            /ไม่มีสิทธิ์/,
          );
          await assert.rejects(
            updateManagedUser(tx, actor, {
              id,
              status: 'SUSPENDED',
              until: '2000-01-01T09:00',
              reason: 'ทดสอบ',
            }),
            /อนาคต/,
          );
          await tx.appUser.update({ where: { id }, data: { role: 'TECHNICIAN' } });
          await tx.technician.update({
            where: { id: tech.id },
            data: { applicationStatus: 'APPROVED', active: true },
          });
          const service = await tx.service.findFirstOrThrow();
          const district = await tx.district.findFirstOrThrow();
          const job = await tx.booking.create({
            data: {
              reference: `QA-${randomUUID()}`,
              customerId: id,
              customerName: 'ประวัติเดิม',
              phone: '0800000000',
              address: 'ที่อยู่จำลอง',
              details: '',
              districtId: district.id,
              date: '2099-01-01',
              time: '09:00',
              serviceId: service.id,
              serviceName: service.name,
              price: 500,
              totalAmount: 500,
              technicianId: tech.id,
            },
          });
          await updateManagedUser(tx, actor, {
            id,
            status: 'SUSPENDED',
            until: '2099-01-01T09:00',
            reason: 'ทดสอบพักบัญชี',
          });
          const suspended = await tx.appUser.findUniqueOrThrow({ where: { id } });
          assert.equal(suspended.suspendedUntil?.toISOString(), '2099-01-01T02:00:00.000Z');
          assert.equal(accountStatus(suspended), 'SUSPENDED');
          assert.equal(await tx.appUser.count({ where: { id, ...activeAccountWhere() } }), 0);
          assert.equal(
            await tx.technician.count({
              where: { id: tech.id, active: true, user: activeAccountWhere() },
            }),
            0,
          );
          const expires = new Date('2099-01-01T02:00:00.000Z');
          assert.equal(accountStatus(suspended, expires), 'ACTIVE');
          assert.equal(
            await tx.technician.count({
              where: { id: tech.id, active: true, user: activeAccountWhere(expires) },
            }),
            1,
          );
          assert.equal(
            (await tx.booking.findUniqueOrThrow({ where: { id: job.id } })).status,
            'PENDING',
          );
          await updateManagedUser(tx, actor, { id, status: 'DISABLED', reason: 'ทดสอบปิด' });
          await updateManagedUser(tx, actor, { id, status: 'ACTIVE' });
          const restored = await tx.appUser.findUniqueOrThrow({ where: { id } });
          assert.equal(restored.role, 'TECHNICIAN');
          assert.equal(restored.suspendedUntil, null);
          assert.equal(restored.suspensionReason, '');
          const preserved = await tx.technician.findUniqueOrThrow({ where: { id: tech.id } });
          assert.equal(preserved.applicationStatus, 'APPROVED');
          assert.deepEqual(preserved.portfolioPaths, [path]);
          assert.equal(preserved.userId, id);
          const existing = await tx.$queryRaw<
            { status: string }[]
          >`SELECT public.fixflow_email_status(${`  ${email.toUpperCase()}  `}::text) AS status`;
          assert.equal(existing[0].status, 'CONFIRMED');
          const available = await tx.$queryRaw<
            { status: string }[]
          >`SELECT public.fixflow_email_status(${`${randomUUID()}@test.example`}::text) AS status`;
          assert.equal(available[0].status, 'AVAILABLE');
          const privileges = await tx.$queryRaw<
            { role: string; allowed: boolean }[]
          >`SELECT rolname AS role, has_function_privilege(oid, 'public.fixflow_email_status(text)', 'EXECUTE') AS allowed FROM pg_roles WHERE rolname IN ('anon','authenticated','fixflow_app')`;
          for (const role of privileges)
            assert.equal(role.allowed, role.role === 'fixflow_app', role.role);
          throw rollback;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 45000 },
      ),
      (error) => error === rollback,
    );
    assert.equal(await prisma.appUser.count({ where: { id: { in: [id, adminId] } } }), 0);
  } finally {
    await prisma.$disconnect();
  }
});
