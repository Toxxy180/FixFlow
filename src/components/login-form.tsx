'use client';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, LoaderCircle, ShieldCheck, UserRound, Wrench } from 'lucide-react';
import {
  demoLogin,
  loginWithPassword,
  registerAccount,
  resendSignupCode,
  verifyRegistration,
  sendPasswordReset,
  verifyRecoveryCode,
  resetAccountPassword,
  startGoogleLogin,
} from '@/app/auth/actions';
import { registrationSchema, passwordPairSchema } from '@/lib/auth-validation';
import type { AuthActionResult } from '@/lib/types';

type Mode = 'login' | 'register' | 'forgot';
export function LoginForm({
  demo = false,
  configured,
  googleEnabled = false,
  mode = 'login',
  notice = '',
}: {
  demo?: boolean;
  configured: boolean;
  googleEnabled?: boolean;
  mode?: Mode;
  notice?: string;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<'FORM' | 'VERIFY' | 'RESET'>('FORM');
  const [signupType, setSignupType] = useState<'CUSTOMER' | 'TECHNICIAN'>('CUSTOMER');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const title =
    step === 'RESET'
      ? 'ตั้งรหัสผ่านใหม่'
      : step === 'VERIFY'
        ? 'ยืนยันอีเมล'
        : mode === 'register'
          ? 'สร้างบัญชี FixFlow'
          : mode === 'forgot'
            ? 'ลืมรหัสผ่าน'
            : 'เข้าสู่ระบบ';
  function handle(result: AuthActionResult) {
    if (result.error) setError(result.error);
    if (result.step) {
      setStep(result.step);
      setToken('');
      if (!result.error && result.step === 'VERIFY') setCooldown(60);
    }
    if (result.redirectTo) {
      router.replace(result.redirectTo);
      router.refresh();
    }
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-8 max-sm:p-5">
      <h1 className="text-3xl font-bold max-sm:text-2xl">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {step === 'VERIFY'
          ? mode === 'forgot'
            ? `หากมีบัญชี ${email} ระบบจะส่งรหัสสำหรับตั้งรหัสผ่านให้`
            : `กรอกรหัสที่ส่งไปยัง ${email} เพื่อยืนยันบัญชี`
          : step === 'RESET'
            ? 'ตั้งรหัสผ่านสำหรับเข้าสู่ระบบครั้งต่อไป'
            : mode === 'register'
              ? 'เลือกประเภทบัญชี กรอกข้อมูล และยืนยันอีเมลด้วย OTP'
              : mode === 'forgot'
                ? 'รับ OTP ทางอีเมลเพื่อตั้งรหัสผ่านใหม่ หรือเพิ่มรหัสผ่านให้บัญชีเดิม'
                : 'ใช้อีเมลและรหัสผ่าน หรือเข้าสู่ระบบด้วย Google'}
      </p>
      {notice && !error ? (
        <p role="status" className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-primary">
          {notice}
        </p>
      ) : null}
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          setError('');
          setMessage('');
          if (step === 'FORM' && mode === 'register') {
            const parsed = registrationSchema.safeParse(Object.fromEntries(data));
            if (!parsed.success) {
              setError(parsed.error.issues[0].message);
              return;
            }
          }
          if (step === 'RESET') {
            const parsed = passwordPairSchema.safeParse(Object.fromEntries(data));
            if (!parsed.success) {
              setError(parsed.error.issues[0].message);
              return;
            }
          }
          start(async () => {
            try {
              if (step === 'VERIFY')
                handle(
                  await (mode === 'forgot'
                    ? verifyRecoveryCode(email, token)
                    : verifyRegistration(email, token)),
                );
              else if (step === 'RESET') handle(await resetAccountPassword(data));
              else if (mode === 'register') handle(await registerAccount(data));
              else if (mode === 'forgot') handle(await sendPasswordReset(email));
              else handle(await loginWithPassword(data));
            } catch {
              setError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่');
            }
          });
        }}
      >
        <fieldset disabled={pending || !ready} className="space-y-4">
          {step === 'FORM' && mode === 'register' ? (
            <>
              <fieldset>
                <legend className="label">ต้องการสมัครเป็น</legend>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        value: 'CUSTOMER',
                        label: 'ลูกค้า',
                        detail: 'ค้นหาและจองช่าง',
                        Icon: UserRound,
                      },
                      {
                        value: 'TECHNICIAN',
                        label: 'ช่าง',
                        detail: 'ส่งใบสมัครให้ตรวจสอบ',
                        Icon: Wrench,
                      },
                    ] as const
                  ).map(({ value, label, detail, Icon }) => (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-xl border p-3 ${signupType === value ? 'border-primary bg-soft' : 'border-line'}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="radio"
                          name="signupType"
                          value={value}
                          checked={signupType === value}
                          onChange={() => setSignupType(value)}
                        />
                        <Icon size={17} />
                        {label}
                      </span>
                      <span className="mt-2 block text-xs text-muted">{detail}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {signupType === 'TECHNICIAN' ? (
                <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                  <ShieldCheck size={18} className="shrink-0" />
                  หลังยืนยันบัญชี ให้กรอกข้อมูลและแนบรูปผลงาน ช่างจะเปิดรับงานได้เมื่อ Admin อนุมัติ
                  ระหว่างรอยังจองบริการได้
                </p>
              ) : null}
              <div>
                <label htmlFor="signup-name" className="label">
                  ชื่อที่แสดง
                </label>
                <input
                  id="signup-name"
                  name="name"
                  className="input"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  required
                  placeholder="ชื่อของคุณ"
                />
              </div>
            </>
          ) : null}
          {step === 'FORM' ? (
            <div>
              <label htmlFor="email" className="label">
                อีเมล
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                maxLength={254}
                required
                placeholder="you@example.com"
              />
            </div>
          ) : null}
          {(step === 'FORM' && mode !== 'forgot') || step === 'RESET' ? (
            <>
              <PasswordField
                label={step === 'RESET' ? 'รหัสผ่านใหม่' : 'รหัสผ่าน'}
                name="password"
                newPassword={mode === 'register' || step === 'RESET'}
              />
              {mode === 'register' || step === 'RESET' ? (
                <>
                  <PasswordField label="ยืนยันรหัสผ่าน" name="confirmPassword" newPassword />
                  <p className="text-xs leading-relaxed text-muted">
                    อย่างน้อย 8 ตัวอักษร มีตัวอักษรภาษาอังกฤษและตัวเลข
                  </p>
                </>
              ) : null}
            </>
          ) : null}
          {step === 'VERIFY' ? (
            <div>
              <label htmlFor="otp" className="label">
                รหัส OTP
              </label>
              <input
                id="otp"
                className="input text-center text-2xl tracking-[0.3em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
                pattern="[0-9]{6,8}"
                required
                autoFocus
                placeholder="รหัส OTP"
              />
              <p className="mt-2 text-xs text-muted">
                ใช้รหัสล่าสุด รหัสใช้ได้ครั้งเดียวและมีเวลาหมดอายุ
              </p>
            </div>
          ) : null}
        </fieldset>
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}
        {!configured ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            ระบบบัญชียังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ
          </p>
        ) : null}
        <button
          type="submit"
          className="btn min-h-12 w-full"
          disabled={pending || !ready || !configured}
        >
          {pending ? (
            <>
              <LoaderCircle size={18} className="animate-spin" />
              กำลังดำเนินการ...
            </>
          ) : step === 'VERIFY' ? (
            'ยืนยัน OTP'
          ) : step === 'RESET' ? (
            'บันทึกรหัสผ่านใหม่'
          ) : mode === 'register' ? (
            'สมัครสมาชิกและรับ OTP'
          ) : mode === 'forgot' ? (
            'ส่งรหัสสำหรับตั้งรหัสผ่าน'
          ) : (
            'เข้าสู่ระบบ'
          )}
        </button>
      </form>
      {step === 'VERIFY' ? (
        <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
          <button
            type="button"
            disabled={pending || cooldown > 0}
            className="font-semibold text-primary disabled:text-muted"
            onClick={() => {
              setError('');
              setMessage('');
              start(async () => {
                try {
                  const result = await (mode === 'forgot'
                    ? sendPasswordReset(email)
                    : resendSignupCode(email));
                  if (result.error) setError(result.error);
                  else {
                    setCooldown(60);
                    setMessage('หากอีเมลตรงกับบัญชีที่รอยืนยัน ระบบจะส่งรหัสใหม่ให้แล้ว');
                  }
                } catch {
                  setError('ส่งรหัสไม่สำเร็จ กรุณาลองใหม่');
                }
              });
            }}
          >
            {cooldown ? `ส่งใหม่ใน ${cooldown} วินาที` : 'ส่งรหัสอีกครั้ง'}
          </button>
          <button
            type="button"
            disabled={pending}
            className="flex items-center gap-1 text-muted"
            onClick={() => {
              setStep('FORM');
              setToken('');
              setError('');
              setMessage('');
            }}
          >
            <ArrowLeft size={14} />
            กลับไปกรอกข้อมูล
          </button>
        </div>
      ) : null}
      {step === 'FORM' && mode !== 'forgot' ? (
        <>
          {mode === 'login' ? (
            <Link href="/forgot-password" className="mt-4 block text-right text-sm text-primary">
              ลืมรหัสผ่าน / ตั้งรหัสผ่านครั้งแรก
            </Link>
          ) : null}
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            หรือ
            <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending || !ready || !configured || !googleEnabled}
            onClick={() => {
              setError('');
              start(async () => {
                try {
                  const result = await startGoogleLogin(mode === 'register' ? signupType : 'LOGIN');
                  if (result.error) setError(result.error);
                  else if (result.redirectTo) window.location.assign(result.redirectTo);
                } catch {
                  setError('เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองใหม่');
                }
              });
            }}
          >
            <span aria-hidden="true" className="text-lg font-bold text-primary">
              G
            </span>
            {mode === 'register' ? 'สมัครด้วย Google' : 'เข้าสู่ระบบด้วย Google'}
          </button>
          {!googleEnabled ? (
            <p className="mt-2 text-center text-xs text-muted">
              Google ยังไม่เปิดให้ใช้งาน สามารถใช้อีเมลได้ตามปกติ
            </p>
          ) : null}
          {mode === 'register' ? (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Google ใช้การยืนยันบัญชีจาก Google ผู้สมัครช่างยังต้องผ่านการอนุมัติเช่นเดียวกัน
            </p>
          ) : null}
        </>
      ) : null}
      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
        {mode === 'register' ? (
          <>
            มีบัญชีแล้ว?{' '}
            <Link href="/login" className="font-semibold text-primary">
              เข้าสู่ระบบ
            </Link>
          </>
        ) : mode === 'forgot' ? (
          <Link href="/login" className="font-semibold text-primary">
            กลับไปเข้าสู่ระบบ
          </Link>
        ) : (
          <>
            ยังไม่มีบัญชี?{' '}
            <Link href="/register" className="font-semibold text-primary">
              สมัครสมาชิก
            </Link>
          </>
        )}
      </p>
      {demo && mode === 'login' ? (
        <div className="mt-5 rounded-xl bg-soft p-4">
          <p className="text-sm font-semibold">ทดลองในเครื่อง</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['CUSTOMER', 'TECHNICIAN', 'ADMIN'] as const).map((role, index) => (
              <button
                key={role}
                type="button"
                disabled={pending}
                className="rounded-lg border border-line bg-white px-2 py-2 text-sm text-primary"
                onClick={() =>
                  start(async () => {
                    try {
                      handle(await demoLogin(role));
                    } catch {
                      setError('เข้าสู่โหมดทดลองไม่สำเร็จ');
                    }
                  })
                }
              >
                {['ลูกค้า', 'ช่าง', 'Admin'][index]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PasswordField({
  label,
  name,
  newPassword = false,
}: {
  label: string;
  name: string;
  newPassword?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          className="input pr-12"
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          required
          minLength={newPassword ? 8 : 1}
          maxLength={newPassword ? 72 : 1024}
        />
        <button
          type="button"
          aria-label={`${visible ? 'ซ่อน' : 'แสดง'}${label}`}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-3 text-muted"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
