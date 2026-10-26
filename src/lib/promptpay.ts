import { mobilePhoneSchema } from './phone';

function field(id: string, value: string) {
  return id + String(value.length).padStart(2, '0') + value;
}

// CRC-16/CCITT-FALSE, as specified by EMV merchant-presented QR / Thai QR Payment.
export function crc16(value: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function promptPayPayload(phone: string, amount: number) {
  const mobile = mobilePhoneSchema.parse(phone);
  // FixFlow stores whole baht, including parts. Never accept an amount supplied by the browser.
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10000000)
    throw new Error('Invalid payment amount');
  const merchant = field('00', 'A000000677010111') + field('01', '0066' + mobile.slice(1));
  const payload =
    field('00', '01') +
    field('01', '12') +
    field('29', merchant) +
    field('53', '764') +
    field('54', amount.toFixed(2)) +
    field('58', 'TH') +
    '6304';
  return payload + crc16(payload);
}
