import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(new URL('../public/brand/fixflow-logo.svg', import.meta.url));
for (const [target, size] of [
  ['../public/brand/fixflow-logo.png', 1024],
  ['../src/app/icon.png', 256],
  ['../src/app/apple-icon.png', 180],
]) {
  await sharp(source, { density: 600 })
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(target, import.meta.url)));
}
const png = await sharp(source, { density: 96 }).resize(32, 32).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6);
ico.writeUInt8(32, 7);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
await writeFile(new URL('../src/app/favicon.ico', import.meta.url), Buffer.concat([ico, png]));
console.log('Exported FixFlow logo PNG, favicon, web icon and Apple icon.');
