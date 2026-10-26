'use client';
import { useState } from 'react';
import { saveMyTechnicianProfile } from '@/app/technician/profile/actions';
import { times } from '@/lib/constants';
import { ActionForm } from './action-form';

type WorkProfile = {
  name: string;
  category: string;
  description: string;
  price: number;
  experience: number;
  portfolioUrl: string;
  workDays: number[];
  availableTimes: string[];
  districtIds: string[];
};

export function TechnicianProfileForm({
  technician,
  categories,
  districts,
}: {
  technician: WorkProfile;
  categories: { id: string; name: string; active: boolean }[];
  districts: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState(technician.districtIds);
  return (
    <ActionForm action={saveMyTechnicianProfile} label="บันทึกข้อมูลรับงาน">
      <div>
        <label className="label" htmlFor="work-name">
          ชื่อช่างที่แสดงให้ลูกค้าเห็น
        </label>
        <input
          id="work-name"
          name="name"
          className="input"
          required
          minLength={2}
          maxLength={80}
          defaultValue={technician.name}
        />
      </div>
      <div>
        <label className="label" htmlFor="work-category">
          ประเภทช่าง
        </label>
        <select
          id="work-category"
          name="category"
          className="input"
          required
          defaultValue={technician.category}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.active ? '' : ' (ปิดใช้งาน)'}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="work-description">
          รายละเอียดบริการและความเชี่ยวชาญ
        </label>
        <textarea
          id="work-description"
          name="description"
          className="input"
          rows={4}
          required
          minLength={5}
          maxLength={500}
          defaultValue={technician.description}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <div>
          <label className="label" htmlFor="work-price">
            ค่าบริการขั้นต่ำ (บาท)
          </label>
          <input
            id="work-price"
            name="price"
            type="number"
            className="input"
            required
            min={0}
            max={100000}
            step={1}
            defaultValue={technician.price}
          />
        </div>
        <div>
          <label className="label" htmlFor="work-experience">
            ประสบการณ์ (ปี)
          </label>
          <input
            id="work-experience"
            name="experience"
            type="number"
            className="input"
            required
            min={0}
            max={60}
            step={1}
            defaultValue={technician.experience}
          />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        ราคาจองคำนวณจากราคาบริการของระบบหรือค่าบริการขั้นต่ำของคุณ โดยใช้ราคาที่สูงกว่า
        และบวกค่าเดินทางตามที่ระบบกำหนด
      </p>
      <fieldset>
        <legend className="label">วันเปิดรับงาน (เลือกอย่างน้อย 1 วัน)</legend>
        <div className="flex flex-wrap gap-4">
          {['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'].map(
            (day, index) => (
              <label key={day} className="flex items-center gap-2 text-sm">
                <input
                  name="workDays"
                  type="checkbox"
                  value={index}
                  defaultChecked={technician.workDays.includes(index)}
                />
                {day}
              </label>
            ),
          )}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">ช่วงเวลารับงาน (เลือกอย่างน้อย 1 ช่วง)</legend>
        <div className="flex flex-wrap gap-4">
          {times.map((time) => (
            <label key={time} className="flex items-center gap-2 text-sm">
              <input
                name="availableTimes"
                type="checkbox"
                value={time}
                defaultChecked={technician.availableTimes.includes(time)}
              />
              {time} น.
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">เขตให้บริการในกรุงเทพฯ (เลือกอย่างน้อย 1 เขต)</legend>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>
            เลือกแล้ว {selected.length}/{districts.length} เขต
          </p>
          <div className="flex gap-4 text-primary">
            <button
              type="button"
              onClick={() => setSelected(districts.map((district) => district.id))}
            >
              เลือกทุกเขต
            </button>
            <button type="button" onClick={() => setSelected([])}>
              ล้างพื้นที่
            </button>
          </div>
        </div>
        <div className="grid max-h-64 grid-cols-3 gap-3 overflow-y-auto rounded-lg border border-line p-4 max-sm:grid-cols-2">
          {districts.map((district) => (
            <label key={district.id} className="flex items-center gap-2 text-sm">
              <input
                name="districtIds"
                type="checkbox"
                value={district.id}
                checked={selected.includes(district.id)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setSelected((current) =>
                    checked
                      ? [...current, district.id]
                      : current.filter((id) => id !== district.id),
                  );
                }}
              />
              {district.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="work-portfolio-url">
          ลิงก์ผลงานหรือเพจ (ไม่บังคับ)
        </label>
        <input
          id="work-portfolio-url"
          name="portfolioUrl"
          type="url"
          className="input"
          maxLength={500}
          placeholder="https://..."
          defaultValue={technician.portfolioUrl}
        />
      </div>
    </ActionForm>
  );
}
