> การตั้งค่ารุ่นล่าสุด: อ่าน [Role, PromptPay และ Reset password](docs/FINAL-SETUP.md) ก่อน deploy โดยเฉพาะเทมเพลต Reset password แบบ TokenHash

# FixFlow — WebApps Mini Project - Final

ระบบจองช่างในกรุงเทพมหานคร 50 เขต ด้วย Next.js 16, TypeScript, Tailwind CSS 4, Prisma 6 และ PostgreSQL พร้อม Supabase Auth: อีเมล/รหัสผ่าน, OTP ยืนยันสมัครสมาชิกครั้งเดียว

## ฟังก์ชัน

- Customer: เข้าด้วยอีเมล/รหัสผ่าน, สมัครด้วย OTP และกู้รหัสผ่านด้วยลิงก์อีเมล, ค้นหาช่าง/บริการ/เขต, เลือกเวลาว่าง, จองและติดตามงาน, ยกเลิกตามเงื่อนไข, ชำระเงินจำลอง, รีวิวครั้งเดียว
- Technician: งานที่ได้รับมอบหมาย, รับ/ปฏิเสธงาน, อัปเดตสถานะตามลำดับ, เพิ่มและลบอะไหล่ขณะทำงาน
- ผู้สมัครที่เลือกบทบาทช่างกรอกข้อมูลพร้อมแนบรูปผลงาน รอ Admin ตรวจและอนุมัติ ทุกบทบาทเลือกรูปโปรไฟล์ ดูตัวอย่าง แล้วบันทึกหรือยกเลิกได้
- หน้า Register แยกสมัครลูกค้า/ช่าง และเก็บชื่อหลังยืนยันบัญชี บัญชีเดิมที่เคยใช้ OTP ตั้งรหัสผ่านครั้งแรกได้จากหน้าลืมรหัสผ่าน
- Admin: Dashboard, จัดการช่าง/พื้นที่/ตารางรับงาน, บริการและหมวดหมู่, role/สถานะผู้ใช้, config และ audit log
- ป้องกันเวลาซ้ำด้วย PostgreSQL unique constraint และ transaction
- ราคาของงานเป็น snapshot ไม่เปลี่ยนตามการแก้ราคาบริการภายหลัง
- ตรวจสิทธิ์และเจ้าของข้อมูลบน server ทุก action; RLS ป้องกัน browser เรียกตารางตรง
- รองรับมือถือ ฟอร์ม pending/error/success และสถานะว่าง

## ทดลองในเครื่องก่อนสร้าง Supabase

ตั้งค่าบัญชีจริงตาม [คู่มือระบบบัญชี](docs/AUTH-SETUP.md) และดู [รายการปรับปรุงระบบบัญชี](docs/ACCOUNT-CHANGES.md)

ต้องมี Node.js 22 หรือ 24 และติดตั้ง dependencies ด้วย `npm install`

เปิด Terminal แรก:

```powershell
npm run db:local
```

ใช้ TCP `DATABASE_URL` ที่ Prisma แสดง ใส่ใน `.env` ทั้ง `DATABASE_URL` และ `DIRECT_URL` เปลี่ยน host เป็น `127.0.0.1` และ `connection_limit=1` สำหรับฐานข้อมูลทดลองในเครื่อง เพิ่ม `&pgbouncer=true` ใน query string เพื่อใช้กับ local proxy และเว้นค่า Supabase URL/key ว่าง

เปิด Terminal ที่สอง:

```powershell
npm run db:setup
npm run db:seed:demo
npm run dev:demo
```
## คำสั่งตรวจงาน

```powershell
npm test
npm run test:db
npm run typecheck
npm run build
npm start
npm run check:deploy
```

- `test`: กฎราคา วันที่ สิทธิ์ workflow, redirect และการปิด demo ใน production
- `test:db`: ทดสอบ workflow/transaction กับ PostgreSQL localhost เท่านั้น และล้าง fixture ของตัวเอง
- `check:deploy`: ตรวจ env, Supabase configuration, runtime role และข้อมูล 50 เขต ไม่เผย secret ในผลลัพธ์
- `db:setup`: ใช้ migration PostgreSQL ที่แนบมาและ seed แบบไม่เขียนทับข้อมูลที่แก้แล้ว
- `admin:grant -- EMAIL`: กำหนด Admin ให้บัญชีที่เข้าสู่ระบบและยืนยันอีเมลแล้ว

## โครงสร้าง

```text
src/app/                    หน้าเว็บ, route handlers และ Server Actions
src/app/admin/              Dashboard และ CRUD/config
src/app/technician/         หน้างานของช่าง
src/app/bookings/           รายการและรายละเอียดงาน
src/lib/auth.ts             Session และ role จาก server
src/lib/booking-service.ts  Transactions และกฎธุรกิจ
src/lib/supabase/           Supabase SSR client
src/proxy.ts               Refresh auth cookies
src/components/            UI และฟอร์มที่ใช้ซ้ำ
prisma/schema.prisma       PostgreSQL models
prisma/migrations/         PostgreSQL migrations และ RLS
prisma/seed.mjs            ข้อมูลตั้งต้น โดยไม่สร้าง Admin ออนไลน์
scripts/                   Local demo, bootstrap Admin และ deployment checks
tests/                     Unit และ PostgreSQL integration tests
docs/                      Deploy, ขอบเขตงาน และแนวทางภาพออกแบบ
```

ma/dev.db` (gitignored) และเก็บ schema/migration เดิมใน `prisma/legacy-sqlite/` ไม่ได้นำรายการ anonymous เดิมมาเป็นงานของบัญชีใหม่โดยอัตโนมัติ เพราะยังไม่มีข้อมูลจับคู่เจ้าของบัญชี

รายละเอียดสโคปและแนวทางสาธิต: [Mini Project](docs/MINI-PROJECT.md)

เอกสารทางการ: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Prisma + Supabase](https://supabase.com/docs/guides/database/prisma)
