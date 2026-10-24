'use client';
import { useState } from 'react';
import { saveTechnician } from '@/app/admin/actions';
import { ActionForm } from './action-form';
import { times } from '@/lib/constants';
type EditorData = {
  id: string;
  name: string;
  initials: string;
  category: string;
  description: string;
  price: number;
  color: string;
  experience: number;
  active: boolean;
  userId: string | null;
  workDays: number[];
  availableTimes: string[];
  districtIds: string[];
};
export function TechnicianEditor({
  technician,
  categories,
  districts,
  users,
}: {
  technician?: EditorData;
  categories: { id: string; name: string }[];
  districts: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
}) {
  const [selected, setSelected] = useState(technician?.districtIds || districts.map((d) => d.id));
  const prefix = technician?.id || 'new-tech';
  return (
    <ActionForm
      action={saveTechnician}
      resetOnSuccess={!technician}
      label={technician ? 'บันทึกข้อมูลช่าง' : 'เพิ่มช่าง'}
    >
      <input name="id" type="hidden" value={technician?.id || ''} />
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <div>
          <label className="label" htmlFor={`${prefix}-name`}>
            ชื่อช่าง
          </label>
          <input
            id={`${prefix}-name`}
            name="name"
            className="input"
            defaultValue={technician?.name}
            required
            minLength={2}
            maxLength={80}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${prefix}-initials`}>
            ชื่อย่อบนรูปโปรไฟล์
          </label>
          <input
            id={`${prefix}-initials`}
            name="initials"
            className="input"
            defaultValue={technician?.initials}
            required
            maxLength={4}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${prefix}-category`}>
            ประเภทช่าง
          </label>
          <select
            id={`${prefix}-category`}
            name="category"
            className="input"
            defaultValue={technician?.category || categories[0]?.id}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${prefix}-price`}>
            ค่าบริการขั้นต่ำ (บาท)
          </label>
          <input
            id={`${prefix}-price`}
            name="price"
            className="input"
            type="number"
            defaultValue={technician?.price || 0}
            required
            min={0}
            max={100000}
            step={1}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${prefix}-experience`}>
            ประสบการณ์ (ปี)
          </label>
          <input
            id={`${prefix}-experience`}
            name="experience"
            className="input"
            type="number"
            defaultValue={technician?.experience || 0}
            required
            min={0}
            max={60}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${prefix}-color`}>
            สีรูปโปรไฟล์
          </label>
          <select
            id={`${prefix}-color`}
            name="color"
            className="input"
            defaultValue={technician?.color || 'blue'}
          >
            <option value="blue">น้ำเงิน</option>
            <option value="amber">ส้ม</option>
            <option value="teal">เขียว</option>
            <option value="purple">ม่วง</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-description`}>
          รายละเอียดบริการ
        </label>
        <textarea
          id={`${prefix}-description`}
          name="description"
          className="input"
          rows={2}
          required
          minLength={5}
          maxLength={500}
          defaultValue={technician?.description}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${prefix}-user`}>
          เชื่อมบัญชีช่าง
        </label>
        <select
          id={`${prefix}-user`}
          name="userId"
          className="input"
          defaultValue={technician?.userId || ''}
        >
          <option value="">ยังไม่เชื่อมบัญชี</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.email}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted">
          ใบสมัครจากลูกค้าจะเชื่อมบัญชีให้อัตโนมัติ ใช้ปุ่มอนุมัติเพื่อเปิดรับงาน
        </p>
      </div>
      <div>
        <p className="label">วันเปิดรับงาน</p>
        <div className="flex flex-wrap gap-4">
          {['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'].map((day, i) => (
            <label key={day} className="flex items-center gap-2 text-sm">
              <input
                name="workDays"
                type="checkbox"
                value={i}
                defaultChecked={technician ? technician.workDays.includes(i) : true}
              />
              {day}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="label">ช่วงเวลารับงาน</p>
        <div className="flex flex-wrap gap-4">
          {times.map((time) => (
            <label key={time} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="availableTimes"
                value={time}
                defaultChecked={technician ? technician.availableTimes.includes(time) : true}
              />
              {time} น.
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">พื้นที่ให้บริการ ({selected.length}/50 เขต)</p>
          <div className="flex gap-3 text-xs text-primary">
            <button type="button" onClick={() => setSelected(districts.map((d) => d.id))}>
              เลือกทุกเขต
            </button>
            <button type="button" onClick={() => setSelected([])}>
              ล้างพื้นที่
            </button>
          </div>
        </div>
        <div className="grid max-h-56 grid-cols-3 gap-3 overflow-y-auto rounded-lg border border-line p-4 max-sm:grid-cols-2">
          {districts.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input
                name="districtIds"
                type="checkbox"
                value={d.id}
                checked={selected.includes(d.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? [...selected, d.id] : selected.filter((id) => id !== d.id),
                  )
                }
              />
              {d.name}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={technician?.active ?? true} />
        เปิดรับงานและแสดงบนหน้าค้นหา
      </label>
    </ActionForm>
  );
}
