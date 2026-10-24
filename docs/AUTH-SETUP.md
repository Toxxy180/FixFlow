# ตั้งค่าอีเมล + รหัสผ่าน และ Google สำหรับ FixFlow

## ระบบที่เตรียมไว้

- `/login`: เข้าด้วยอีเมลและรหัสผ่าน หรือ Google
- `/register`: เลือกลูกค้า/ช่าง กรอกชื่อ อีเมล รหัสผ่านและยืนยันรหัสผ่าน แล้วกรอก OTP
- `/forgot-password`: ขอ OTP → ยืนยัน → ตั้งรหัสผ่านใหม่ ใช้ตั้งรหัสผ่านครั้งแรกให้บัญชีที่เคยเข้าแบบ OTP ได้ด้วย
- สมัครช่างแล้วต้องกรอกใบสมัคร แนบรูป และรอ Admin อนุมัติ ก่อนปรากฏในหน้าค้นหาและรับงาน ระหว่างรอยังคงใช้สิทธิ์ลูกค้าได้
- Google ยืนยันตัวตนผ่าน Google จึงไม่ส่ง OTP ของ FixFlow ซ้ำ ผู้สมัครช่างยังต้องผ่าน Admin เหมือนเดิม
- ชื่อเก็บใน AppUser หลังยืนยันอีเมล รหัสผ่านจัดการโดย Supabase Auth ไม่เก็บรหัสผ่านหรือรหัส OTP ในตาราง AppUser หรือ log
- ไม่ต้องเพิ่มตารางหรือ migration สำหรับการเปลี่ยนระบบล็อกอินนี้ ชื่อ/ประเภทสมัครเก็บใน Auth metadata และนำมาใช้เฉพาะชื่อแสดง/ทางไปกรอกใบสมัคร สิทธิ์จริงอ่านจาก AppUser เท่านั้น

## 1. Supabase: เปิดอีเมลและการยืนยัน

เปิดโปรเจกต์ FixFlow → **Authentication → Sign In / Providers → Email** (ชื่อเมนูอาจแสดงเป็น Providers)

1. เปิด Email provider และอนุญาตให้สมัครสมาชิกใหม่
2. เปิด **Confirm email** เพื่อให้ต้องยืนยันอีเมลก่อนเข้าสู่ระบบ
3. ตั้งรหัสผ่านขั้นต่ำอย่างน้อย 8 ตัวอักษร หน้าเว็บกำหนดให้มีตัวอักษรภาษาอังกฤษและตัวเลขด้วย
4. ใช้ SMTP เดิมที่ตั้งสำเร็จแล้ว ไม่ต้องเปลี่ยนผู้ให้บริการ

## 2. เปลี่ยนอีเมลให้แสดง OTP

เปิด **Authentication → Emails → Templates** แก้ **Confirm sign up** และ **Reset password** ทีละรายการ แล้วบันทึกทั้งสองอัน:

```html
<h2>รหัสยืนยัน FixFlow</h2>
<p>นำรหัสนี้ไปกรอกในเว็บไซต์ หากคุณไม่ได้ทำรายการนี้ให้ข้ามอีเมลนี้ได้</p>
<h1>{{ .Token }}</h1>
<p>อย่าส่งรหัสนี้ให้ผู้อื่น</p>
```

**Reset password จำเป็นสำหรับบัญชีเดิมและการลืมรหัสผ่าน** หากยังใช้เทมเพลตลิงก์เดิม ระบบจะส่งลิงก์แทนตัวเลข และฟอร์ม OTP จะใช้งานไม่ได้ ตั้ง subject เช่น “รหัสยืนยันสมัครสมาชิก FixFlow” และ “รหัสตั้งรหัสผ่าน FixFlow” ให้แยกกันได้

เทมเพลต Magic link or OTP เดิมเก็บไว้ได้ แต่หน้าล็อกอินใหม่ไม่ได้ขอ OTP แบบไม่มีรหัสผ่านอีกแล้ว

## 3. ตั้ง URL ของเว็บ

เปิด **Authentication → URL Configuration**:

- Site URL ระหว่างพัฒนา: `http://localhost:3000`
- Redirect URLs: เพิ่ม `http://localhost:3000/auth/callback`
- เมื่อ Deploy: เปลี่ยน Site URL เป็น URL จริง และเพิ่ม `https://YOUR_SITE/auth/callback`
- ใน Vercel เพิ่ม `APP_URL=https://YOUR_SITE` โดยไม่มี path หรือ query ต่อท้าย

ในเครื่องใช้ `APP_URL="http://localhost:3000"` ตาม `.env.example` ได้ หากยังไม่ใส่ ระบบใช้ localhost:3000 เป็นค่าเริ่มต้น เมื่อแก้ env ให้เริ่ม dev server ใหม่

## 4. สร้าง Google OAuth Client

ทำส่วนนี้ในบัญชีของคุณ ไม่ต้องส่ง Client Secret หรือรหัสผ่านเข้ามาในแชท

1. เปิด [Google Cloud Console](https://console.cloud.google.com/) แล้วเลือกหรือสร้างโปรเจกต์สำหรับ FixFlow
2. เปิด **Google Auth Platform** กำหนด Branding: ชื่อ FixFlow, อีเมลสำหรับติดต่อ และข้อมูลที่ระบบร้องขอ
3. ตั้ง Audience ให้เหมาะกับผู้ทดสอบ หากยังเป็น Testing ให้เพิ่มบัญชี Google ที่จะใช้สาธิตใน Test users
4. เปิด **Clients → Create client → Web application**
5. Authorized JavaScript origins: ใส่ `http://localhost:3000` และ URL จริงหลัง Deploy (เฉพาะ origin ไม่มี `/auth/callback`)
6. Authorized redirect URIs: คัดลอก Callback URL จาก **Supabase → Authentication → Sign In / Providers → Google**

สำหรับโปรเจกต์ Supabase นี้ URL คือ:

```text
https://zznyawsqfqsxxincxjwp.supabase.co/auth/v1/callback
```

7. สร้างแล้วนำ Client ID และ Client Secret ไปใส่ในหน้า Google provider ของ Supabase เปิดใช้งานและบันทึก
8. เปิดหน้า FixFlow `/login` ใหม่ ปุ่ม Google จะเปิดใช้งานเมื่อ Supabase เปิด provider แล้ว ถ้ายังปิดอยู่ ปุ่มจะแสดงว่ายังไม่พร้อมใช้งาน

Google ใช้ callback ของ **Supabase** ส่วน Supabase ใช้ callback ของ **FixFlow** จึงมี URL คนละอัน:

```text
FixFlow → Supabase → Google → Supabase /auth/v1/callback → FixFlow /auth/callback
```

Client Secret อยู่ใน Supabase เท่านั้น ไม่เพิ่ม Google Client Secret ใน `.env` ของ Next.js และไม่ใส่ใน Git

## 5. บัญชีเดิมและ Admin

บัญชีเดิม ข้อมูลช่าง รูป งานจอง และสิทธิ์ Admin ยังคงเดิม:

1. หน้า `/login` กด **ลืมรหัสผ่าน / ตั้งรหัสผ่านครั้งแรก**
2. กรอกอีเมลเดิม รับ OTP จากเทมเพลต Reset password และยืนยัน
3. ตั้งรหัสผ่านใหม่ จากนั้นเข้าสู่ระบบด้วยอีเมลเดิมและรหัสผ่าน
4. Admin เข้าหน้า Dashboard ลูกค้าเข้าค้นหาช่าง ช่างที่อนุมัติแล้วเข้า **งานของฉัน** ผู้สมัครช่างที่กรอกข้อมูลไม่ครบจะไปกรอกใบสมัครต่อ

รหัส OTP สำหรับกู้รหัสผ่านตรวจเป็นชนิด recovery โดยเฉพาะ หลังผ่านจึงมีสิทธิ์ตั้งรหัสผ่านอายุ 10 นาที ใช้ได้ครั้งเดียว หลังตั้งสำเร็จออกจากทุก session และให้เข้าสู่ระบบใหม่

## 6. ทดสอบก่อนส่งงาน

- ลูกค้า: สมัคร → รับ OTP → ยืนยัน → ค้นหาช่าง/จองงาน
- ช่าง: สมัครเป็นช่าง → OTP → กรอกใบสมัคร/แนบรูป → รออนุมัติ → Admin ตรวจรูปและอนุมัติ → เปิดรับงาน
- กรอกรหัสผ่านไม่ตรงกัน รหัส OTP ผิด/หมดอายุ และกดส่งใหม่หลัง 60 วินาที
- Login ผิดต้องไม่บอกว่ามีอีเมลนั้นอยู่ในระบบหรือไม่
- บัญชีเดิมตั้งรหัสผ่านครั้งแรกได้ และ Admin ยังคงเป็น Admin
- Google จากหน้าล็อกอิน และ Google จากหน้าสมัครที่เลือกช่าง
- กดยกเลิก Google ต้องกลับมาข้อความที่เข้าใจได้ ไม่แสดง token/error ดิบ
- บัญชีถูกระงับต้องเข้าไม่ได้ทั้งรหัสผ่าน Google และการกู้รหัสผ่าน
- Deploy แล้วทดสอบซ้ำด้วย HTTPS และ callback URL จริง

## เอกสารทางการ

- [Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Resend signup confirmation](https://supabase.com/docs/reference/javascript/auth-resend)
- [Verify OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp)
