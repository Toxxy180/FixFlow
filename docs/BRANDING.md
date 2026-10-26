# เปลี่ยนโลโก้ FixFlow

โลโก้ตามภาพอ้างอิง: พื้นสีน้ำเงิน `#0866ff` มุมมนและประแจสีขาว ใช้ไฟล์ SVG เพื่อให้คมชัดทุกขนาด

| ตำแหน่ง                                 | ไฟล์                                         |
| --------------------------------------- | -------------------------------------------- |
| ต้นฉบับโลโก้ที่หัวเว็บใช้               | `public/brand/fixflow-logo.svg`              |
| โค้ดแสดงโลโก้ข้างชื่อ FixFlow           | `src/components/header.tsx`                  |
| โลโก้ PNG ความละเอียด 1024 × 1024       | `public/brand/fixflow-logo.png`              |
| ไอคอนแท็บเบราว์เซอร์                    | `src/app/favicon.ico` และ `src/app/icon.png` |
| ไอคอนเมื่อเพิ่มเว็บบนหน้าจอ iPhone/iPad | `src/app/apple-icon.png`                     |

แก้หรือเปลี่ยนต้นฉบับ `public/brand/fixflow-logo.svg` แล้วรัน:

```powershell
npm run brand:export
```

คำสั่งจะสร้าง PNG และไอคอนทุกขนาดใหม่จาก SVG เดียวกัน จากนั้นรีเฟรชเว็บ หากเบราว์เซอร์ยังใช้ไอคอนเก่า ให้ลอง `Ctrl + F5`

ถ้าต้องการใช้ไฟล์ PNG ที่ออกแบบจากที่อื่นเป็นรูปบนหัวเว็บ ให้วางไว้ใน `public/brand/` แล้วแก้ `src` ของ `<Image>` ใน `src/components/header.tsx` เช่น `/brand/my-logo.png` (เส้นทางบนเว็บไม่ต้องมีคำว่า `public`)

Next.js จะเพิ่มไอคอนแท็บและ Apple icon จากไฟล์ใน `src/app/` ให้อัตโนมัติ ส่วนชื่อและคำอธิบายของแท็บแก้ใน `metadata` ของ `src/app/layout.tsx`

รูปประแจใช้ Lucide ภายใต้ ISC License โดยเก็บประกาศลิขสิทธิ์ใน SVG ต้นฉบับ
