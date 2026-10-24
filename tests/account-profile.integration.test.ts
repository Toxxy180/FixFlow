import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { saveAccountProfile } from '../src/lib/account-profile';

test('combined profile updates preserve identity and permissions, own avatars, and roll back atomically', async () => {
  const id = randomUUID();
  const oldPath = `${id}/${randomUUID()}.webp`;
  const newPath = `${id}/${randomUUID()}.webp`;
  const rollback = new Error('ROLLBACK_PROFILE_FIXTURE');
  try {
    await assert.rejects(
      prisma.$transaction(
        async (tx) => {
          await tx.appUser.create({
            data: { id, email: `${id}@test.example`, name: 'ชื่อเดิม', avatarPath: oldPath },
          });
          await tx.userImage.create({ data: { ownerId: id, kind: 'AVATAR', path: oldPath } });
          const profile = {
            name: ' ชื่อใหม่ ',
            phone: '0800000000',
            role: 'ADMIN',
            id: randomUUID(),
            active: false,
          };
          const kept = await saveAccountProfile(tx, id, profile, { action: 'KEEP' });
          assert.equal(kept.profile.name, 'ชื่อใหม่');
          assert.equal(kept.image?.path, oldPath);
          assert.deepEqual(kept.obsoletePaths, []);
          const unchanged = await tx.appUser.findUniqueOrThrow({ where: { id } });
          assert.equal(unchanged.role, 'CUSTOMER');
          assert.equal(unchanged.active, true);
          await assert.rejects(
            saveAccountProfile(tx, id, { ...profile, phone: '12' }, { action: 'REMOVE' }),
          );
          await assert.rejects(
            saveAccountProfile(tx, id, profile, {
              action: 'REPLACE',
              path: `${randomUUID()}/${randomUUID()}.webp`,
            }),
          );
          assert.equal((await tx.appUser.findUniqueOrThrow({ where: { id } })).avatarPath, oldPath);
          const replaced = await saveAccountProfile(
            tx,
            id,
            { ...profile, name: 'ชื่อพร้อมรูปใหม่' },
            { action: 'REPLACE', path: newPath },
          );
          assert.equal(replaced.profile.name, 'ชื่อพร้อมรูปใหม่');
          assert.equal(replaced.image?.path, newPath);
          assert.deepEqual(replaced.obsoletePaths, [oldPath]);
          assert.equal(await tx.userImage.count({ where: { ownerId: id, kind: 'AVATAR' } }), 1);
          const removed = await saveAccountProfile(tx, id, profile, { action: 'REMOVE' });
          assert.equal(removed.image, null);
          assert.deepEqual(removed.obsoletePaths, [newPath]);
          assert.equal((await tx.appUser.findUniqueOrThrow({ where: { id } })).avatarPath, null);
          await tx.appUser.update({ where: { id }, data: { active: false } });
          await assert.rejects(
            saveAccountProfile(tx, id, profile, { action: 'KEEP' }),
            /ไม่พร้อมใช้งาน/,
          );
          throw rollback;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
      ),
      (error) => error === rollback,
    );
    assert.equal(await prisma.appUser.findUnique({ where: { id } }), null);
    assert.equal(await prisma.userImage.count({ where: { ownerId: id } }), 0);
  } finally {
    await prisma.$disconnect();
  }
});
