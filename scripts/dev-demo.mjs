import { spawn } from 'node:child_process';
process.loadEnvFile('.env');
const host = new URL(process.env.DATABASE_URL || '').hostname;
if (
  !['localhost', '127.0.0.1'].includes(host) ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VERCEL
) {
  throw new Error('โหมดสาธิตใช้ได้เฉพาะ PostgreSQL ในเครื่อง และต้องไม่มี Supabase ที่เชื่อมอยู่');
}
console.log('FixFlow: โหมดสาธิตในเครื่อง ไม่ส่ง OTP และไม่ใช้บัญชีจริง');
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1'],
  {
    stdio: 'inherit',
    env: { ...process.env, DEMO_AUTH: 'true' },
  },
);
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
