import { UserError } from './validation';

export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

export async function limitedImageForm(request: Request) {
  const limit = 3 * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > limit)
    throw new UserError('ไฟล์มีขนาดใหญ่เกินไป');
  const reader = request.body?.getReader();
  if (!reader) throw new UserError('ไม่พบข้อมูลที่ต้องการบันทึก');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new UserError('ไฟล์มีขนาดใหญ่เกินไป');
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), {
    headers: { 'Content-Type': request.headers.get('content-type') || '' },
  }).formData();
}
