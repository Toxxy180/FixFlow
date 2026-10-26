import { isAccountAllowed } from '@/lib/account-status';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAppointment } from '@/lib/validation';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('technicianId') || '';
  const date = params.get('date') || '';
  if (id.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: 'วันนัดหมายไม่ถูกต้อง' }, { status: 400 });
  try {
    const [technician, setting, slots] = await Promise.all([
      prisma.technician.findUnique({ where: { id }, include: { categoryModel: true, user: true } }),
      prisma.appSetting.findUnique({ where: { id: 'main' } }),
      prisma.slot.findMany({ where: { technicianId: id, date }, select: { time: true } }),
    ]);
    if (
      !technician?.active ||
      !['NONE', 'APPROVED'].includes(technician.applicationStatus) ||
      !technician.categoryModel.active ||
      (technician.user &&
        (technician.user.role !== 'TECHNICIAN' || !isAccountAllowed(technician.user))) ||
      !setting?.bookingEnabled
    )
      return NextResponse.json({ times: [], reason: 'ช่างหรือระบบพักรับการจองชั่วคราว' });
    const dateError = validateAppointment(date, '23:59', setting.maxAdvanceDays + 1);
    if (dateError) return NextResponse.json({ times: [], reason: dateError });
    const weekday = new Date(`${date}T12:00:00+07:00`).getUTCDay();
    const available = technician.workDays.includes(weekday)
      ? technician.availableTimes.filter(
          (t) =>
            !validateAppointment(date, t, setting.maxAdvanceDays) &&
            !slots.some((s) => s.time === t),
        )
      : [];
    return NextResponse.json(
      {
        times: available,
        reason: available.length
          ? undefined
          : !technician.workDays.includes(weekday)
            ? 'ช่างหยุดรับงานในวันนี้ กรุณาเลือกวันอื่น'
            : 'ช่วงเวลาของวันนี้ผ่านไปแล้วหรือถูกจองเต็ม กรุณาเลือกวันอื่น',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'โหลดช่วงเวลาไม่สำเร็จ' }, { status: 503 });
  }
}
