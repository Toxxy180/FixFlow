'use client';
import { useEffect, useState, type ComponentProps } from 'react';
import { BookingDialog } from './booking-dialog';
export function TechnicianBookingButton(
  props: Omit<ComponentProps<typeof BookingDialog>, 'onClose'>,
) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (props.user.role !== 'CUSTOMER') return null;
  return (
    <>
      <button className="btn" disabled={!ready} onClick={() => setOpen(true)}>
        จองช่างคนนี้
      </button>
      {open ? <BookingDialog {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
