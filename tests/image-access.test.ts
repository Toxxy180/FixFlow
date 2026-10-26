import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { isPublicTechnician } from '../src/lib/technician-visibility';

const ownerId = '00000000-0000-4000-8000-000000000002';
const photoPath = `${ownerId}/00000000-0000-4000-8000-000000000004.webp`;
const visible = {
  active: true,
  applicationStatus: 'APPROVED',
  categoryModel: { active: true },
  user: { active: true, suspendedUntil: null as Date | null, role: 'TECHNICIAN' },
  portfolioPaths: [photoPath],
};

test('technician visibility follows approval, category, account restrictions and suspension expiry', () => {
  assert.equal(isPublicTechnician(visible), true);
  assert.equal(isPublicTechnician({ ...visible, applicationStatus: 'NONE' }), true);
  for (const applicationStatus of ['PENDING', 'REJECTED'])
    assert.equal(isPublicTechnician({ ...visible, applicationStatus }), false);
  assert.equal(isPublicTechnician({ ...visible, active: false }), false);
  assert.equal(isPublicTechnician({ ...visible, categoryModel: { active: false } }), false);
  assert.equal(isPublicTechnician({ ...visible, user: { ...visible.user, active: false } }), false);
  assert.equal(
    isPublicTechnician({ ...visible, user: { ...visible.user, role: 'CUSTOMER' } }),
    false,
  );
  assert.equal(
    isPublicTechnician({
      ...visible,
      user: { ...visible.user, suspendedUntil: new Date('2099-01-01') },
    }),
    false,
  );
  assert.equal(
    isPublicTechnician({
      ...visible,
      user: { ...visible.user, suspendedUntil: new Date('2000-01-01') },
    }),
    true,
  );
});

test('image route exposes only saved public portfolio photos; drafts and pending applications retain owner/Admin access', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'fixflow-image-access-'));
  const state = {
    image: { id: 'image-1', ownerId, kind: 'PORTFOLIO', path: photoPath },
    technician: { ...visible },
    viewer: null as null | { id: string; role: string },
    used: '',
  };
  (globalThis as typeof globalThis & { __imageAccessQA: typeof state }).__imageAccessQA = state;
  const mocks: Record<string, string> = {
    '@/lib/prisma':
      'export const prisma={userImage:{findUnique:async()=>globalThis.__imageAccessQA.image},technician:{findUnique:async()=>globalThis.__imageAccessQA.technician}};',
    '@/lib/auth': 'export const getCurrentUser=async()=>globalThis.__imageAccessQA.viewer;',
  };
  const client = (kind: string) =>
    `export const ${kind === 'public' ? 'createPublicClient' : 'createClient'}=()=>{globalThis.__imageAccessQA.used='${kind}';return {storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://images.example.test/photo'},error:null})})}}};`;
  mocks['@/lib/supabase/public'] = client('public');
  mocks['@/lib/supabase/server'] = client('private');
  try {
    const entry = path.join(folder, 'route.cjs');
    await build({
      entryPoints: [path.resolve('src/app/api/images/[id]/route.ts')],
      outfile: entry,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      tsconfig: path.resolve('tsconfig.json'),
      logLevel: 'silent',
      plugins: [
        {
          name: 'controlled-image-services',
          setup(builder) {
            builder.onResolve({ filter: /.*/ }, (args) =>
              Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'mock' } : undefined,
            );
            builder.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({
              contents: mocks[args.path],
              loader: 'js',
            }));
          },
        },
      ],
    });
    const { GET } = createRequire(import.meta.url)(entry);
    const read = () =>
      GET(new Request('http://localhost/api/images/image-1'), {
        params: Promise.resolve({ id: 'image-1' }),
      });
    assert.equal((await read()).status, 302, 'guests can view saved photos of a public technician');
    assert.equal(state.used, 'public', 'public reads must use anonymous Storage policy');
    state.viewer = { id: 'someone-else', role: 'CUSTOMER' };
    assert.equal((await read()).status, 302);
    state.technician = { ...visible, portfolioPaths: [] };
    assert.equal((await read()).status, 404, 'unselected uploads are never public');
    state.viewer = null;
    assert.equal((await read()).status, 401);
    state.viewer = { id: ownerId, role: 'TECHNICIAN' };
    assert.equal((await read()).status, 302);
    assert.equal(state.used, 'private');
    state.viewer = { id: 'admin-id', role: 'ADMIN' };
    assert.equal((await read()).status, 302);
    state.viewer = null;
    for (const applicationStatus of ['PENDING', 'REJECTED']) {
      state.technician = { ...visible, applicationStatus };
      assert.equal((await read()).status, 401);
    }
    state.technician = { ...visible, active: false };
    assert.equal((await read()).status, 401);
    state.technician = { ...visible };
    state.image.kind = 'AVATAR';
    assert.equal((await read()).status, 401, 'gallery sharing cannot expose other image kinds');
    state.image.kind = 'PORTFOLIO';
    state.image.path = 'invalid/external-path';
    assert.equal((await read()).status, 404);
  } finally {
    const target = path.resolve(folder);
    assert.equal(path.dirname(target), path.resolve(tmpdir()));
    assert.match(path.basename(target), /^fixflow-image-access-/);
    await rm(target, { recursive: true, force: true });
  }
});
