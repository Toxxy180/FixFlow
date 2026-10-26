import { isAccountAllowed } from './account-status';
import { randomBytes } from 'node:crypto';
import { Prisma, type AppUser, type JobStatus } from '@prisma/client';
import { prisma } from './prisma';
import { bookingSchema, quote, UserError, validateAppointment } from './validation';
import { canTransition } from './status';
import { bookingInclude } from './types';
import { roleForBooking } from './booking-access';

type Actor = Pick<AppUser, 'id' | 'role' | 'active'> & { suspendedUntil?: Date | null };
const transactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  timeout: 15000,
};
function ensureActor(actor: Actor) {
  if (!isAccountAllowed(actor)) throw new UserError('บัญชีนี้ถูกระงับ');
}

export async function bookJob(actor: Actor, input: unknown) {
  ensureActor(actor);
  if (actor.role !== 'CUSTOMER') throw new UserError('เฉพาะบัญชีลูกค้าเท่านั้นที่จองช่างได้');
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
  const data = parsed.data;
  return prisma.$transaction(async (tx) => {
    const [customer, setting, technician, service] = await Promise.all([
      tx.appUser.findUnique({ where: { id: actor.id } }),
      tx.appSetting.findUnique({ where: { id: 'main' } }),
      tx.technician.findUnique({
        where: { id: data.technicianId },
        include: { areas: true, categoryModel: true, user: true },
      }),
      tx.service.findUnique({ where: { id: data.serviceId } }),
    ]);
    if (!customer || !isAccountAllowed(customer) || customer.role !== 'CUSTOMER')
      throw new UserError('บัญชีนี้ไม่มีสิทธิ์จองช่าง');
    if (!setting?.bookingEnabled) throw new UserError('ระบบพักรับการจองชั่วคราว');
    const dateError = validateAppointment(data.date, data.time, setting.maxAdvanceDays);
    if (dateError) throw new UserError(dateError);
    if (
      !technician?.active ||
      !technician.categoryModel.active ||
      (technician.user && !isAccountAllowed(technician.user))
    )
      throw new UserError('ช่างนี้ยังไม่เปิดรับงาน');
    if (!service?.active || service.categoryId !== technician.category)
      throw new UserError('บริการนี้ไม่ตรงกับประเภทงานของช่าง');
    if (technician.userId === actor.id)
      throw new UserError('ไม่สามารถจองบริการของตัวเองได้ กรุณาเลือกช่างคนอื่น');
    if (!technician.areas.some((a) => a.districtId === data.districtId))
      throw new UserError('ช่างนี้ยังไม่รับงานในเขตที่เลือก');
    const weekday = new Date(`${data.date}T12:00:00+07:00`).getUTCDay();
    if (!technician.workDays.includes(weekday) || !technician.availableTimes.includes(data.time))
      throw new UserError('ช่างไม่เปิดรับงานในวันหรือเวลานี้');
    const reference = `FF-${randomBytes(4).toString('hex').toUpperCase()}`;
    const cost = quote(service.price, technician.price, setting.travelFee);
    return tx.booking.create({
      data: {
        ...data,
        reference,
        customerId: actor.id,
        customerName: customer.name,
        serviceName: service.name,
        ...cost,
        payment: { create: { amount: cost.totalAmount } },
        slot: { create: { technicianId: data.technicianId, date: data.date, time: data.time } },
        history: { create: { actorId: actor.id, status: 'PENDING', note: 'ลูกค้าสร้างรายการจอง' } },
      },
      select: { id: true, reference: true },
    });
  }, transactionOptions);
}

async function authorizedBooking(tx: Prisma.TransactionClient, actor: Actor, id: string) {
  const current = await tx.appUser.findUnique({ where: { id: actor.id } });
  if (!isAccountAllowed(current) || current?.role !== actor.role)
    throw new UserError('บัญชีนี้ไม่พร้อมใช้งาน กรุณาเข้าสู่ระบบใหม่');
  const booking = await tx.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking) throw new UserError('ไม่พบรายการงาน');
  const allowed = roleForBooking(actor, booking);
  if (!allowed) throw new UserError('คุณไม่มีสิทธิ์จัดการงานนี้');
  return booking;
}

export async function cancelJob(actor: Actor, id: string) {
  ensureActor(actor);
  return prisma.$transaction(async (tx) => {
    const booking = await authorizedBooking(tx, actor, id);
    if (
      booking.status === 'CANCELLED' ||
      booking.status === 'COMPLETED' ||
      booking.payment?.status === 'PAID'
    )
      throw new UserError('รายการนี้ยกเลิกไม่ได้');
    const role = roleForBooking(actor, booking);
    if (role === 'TECHNICIAN' && booking.status !== 'PENDING')
      throw new UserError('ปฏิเสธงานได้เฉพาะงานที่ยังไม่ได้รับ');
    if (role === 'CUSTOMER') {
      if (!['PENDING', 'ACCEPTED'].includes(booking.status))
        throw new UserError('ช่างเริ่มดำเนินงานแล้ว กรุณาติดต่อผู้ดูแลระบบ');
      const setting = await tx.appSetting.findUniqueOrThrow({ where: { id: 'main' } });
      const appointment = new Date(`${booking.date}T${booking.time}:00+07:00`);
      if (appointment.getTime() - Date.now() < setting.cancelBeforeHours * 3600000)
        throw new UserError(`ต้องยกเลิกก่อนเวลานัดอย่างน้อย ${setting.cancelBeforeHours} ชั่วโมง`);
    }
    await tx.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        history: {
          create: { actorId: actor.id, status: 'CANCELLED', note: 'ยกเลิกรายการและคืนช่วงเวลา' },
        },
      },
    });
    await tx.slot.deleteMany({ where: { bookingId: id } });
  }, transactionOptions);
}

export async function advanceJob(actor: Actor, id: string, status: JobStatus) {
  ensureActor(actor);
  return prisma.$transaction(async (tx) => {
    const booking = await authorizedBooking(tx, actor, id);
    const role = roleForBooking(actor, booking);
    if (!role || !canTransition(booking.status, status, role))
      throw new UserError('ไม่สามารถเปลี่ยนไปยังสถานะนี้ได้');
    await tx.booking.update({
      where: { id },
      data: { status, history: { create: { actorId: actor.id, status } } },
    });
  }, transactionOptions);
}

export async function addJobPart(
  actor: Actor,
  id: string,
  name: string,
  quantity: number,
  unitPrice: number,
) {
  ensureActor(actor);
  if (
    !name.trim() ||
    name.length > 100 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 100 ||
    !Number.isInteger(unitPrice) ||
    unitPrice < 0 ||
    unitPrice > 100000
  )
    throw new UserError('กรุณาตรวจสอบชื่ออะไหล่ จำนวน และราคา');
  return prisma.$transaction(async (tx) => {
    const booking = await authorizedBooking(tx, actor, id);
    if (
      !['ADMIN', 'TECHNICIAN'].includes(roleForBooking(actor, booking) || '') ||
      booking.status !== 'IN_PROGRESS'
    )
      throw new UserError('เพิ่มอะไหล่ได้ขณะดำเนินงานเท่านั้น');
    const totalAmount = booking.totalAmount + quantity * unitPrice;
    if (totalAmount > 10000000) throw new UserError('ยอดรวมสูงเกินขอบเขตระบบ');
    await tx.jobPartItem.create({
      data: { bookingId: id, name: name.trim(), quantity, unitPrice },
    });
    await tx.booking.update({ where: { id }, data: { totalAmount } });
    await tx.payment.update({ where: { bookingId: id }, data: { amount: totalAmount } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: 'ADD_PART', targetId: id } });
  }, transactionOptions);
}

export async function removeJobPart(actor: Actor, id: string, partId: string) {
  ensureActor(actor);
  return prisma.$transaction(async (tx) => {
    const booking = await authorizedBooking(tx, actor, id);
    if (
      !['ADMIN', 'TECHNICIAN'].includes(roleForBooking(actor, booking) || '') ||
      booking.status !== 'IN_PROGRESS'
    )
      throw new UserError('แก้ไขอะไหล่ได้ขณะดำเนินงานเท่านั้น');
    const part = booking.parts.find((p) => p.id === partId);
    if (!part) throw new UserError('ไม่พบรายการอะไหล่');
    const totalAmount = booking.totalAmount - part.quantity * part.unitPrice;
    await tx.jobPartItem.delete({ where: { id: partId } });
    await tx.booking.update({ where: { id }, data: { totalAmount } });
    await tx.payment.update({ where: { bookingId: id }, data: { amount: totalAmount } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: 'REMOVE_PART', targetId: id } });
  }, transactionOptions);
}

export async function payDemoJob(actor: Actor, id: string) {
  ensureActor(actor);
  return prisma.$transaction(async (tx) => {
    const booking = await authorizedBooking(tx, actor, id);
    if (
      booking.customerId !== actor.id ||
      booking.status !== 'AWAITING_PAYMENT' ||
      booking.payment?.status === 'PAID'
    )
      throw new UserError('รายการนี้ยังไม่พร้อมชำระเงิน');
    await tx.payment.update({
      where: { bookingId: id },
      data: { amount: booking.totalAmount, status: 'PAID', paidAt: new Date() },
    });
    await tx.booking.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        history: {
          create: {
            actorId: actor.id,
            status: 'COMPLETED',
            note: 'ยืนยันการชำระเงินจำลอง ไม่มีธุรกรรมเงินจริง',
          },
        },
      },
    });
  }, transactionOptions);
}

export async function reviewJob(actor: Actor, id: string, rating: number, comment: string) {
  ensureActor(actor);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 500)
    throw new UserError('คะแนนต้องอยู่ระหว่าง 1–5 และข้อความไม่เกิน 500 ตัวอักษร');
  return prisma.$transaction(async (tx) => {
    const booking = await authorizedBooking(tx, actor, id);
    if (booking.customerId !== actor.id || booking.status !== 'COMPLETED' || booking.review)
      throw new UserError('รีวิวได้หนึ่งครั้งหลังงานเสร็จสิ้นเท่านั้น');
    await tx.review.create({
      data: {
        bookingId: id,
        customerId: actor.id,
        technicianId: booking.technicianId,
        rating,
        comment: comment.trim(),
      },
    });
  }, transactionOptions);
}
