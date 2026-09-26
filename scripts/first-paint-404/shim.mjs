// #404: serve @tailwindcss/browser and the @barocss/browser UMD from jsDelivr, in memory only (no disk writes).
// Reads of /__mem__/twb/dist/index.global.js and /__mem__/baro.js return the CDN bytes.
import fs from 'node:fs';

const TWB = process.env.TWB_VERSION || '4.1.13';
const BARO = process.env.BARO_VERSION || '0.10.3';
const get = async (u) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${u} ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};
const mem = {
  '/__mem__/twb/dist/index.global.js': await get(`https://cdn.jsdelivr.net/npm/@tailwindcss/browser@${TWB}/dist/index.global.js`),
  '/__mem__/baro.js': await get(`https://cdn.jsdelivr.net/npm/@barocss/browser@${BARO}/dist/cdn/barocss.umd.cjs`),
};
const read = fs.readFileSync;
const stat = fs.statSync;
fs.readFileSync = (p, ...a) => {
  const b = mem[String(p)];
  return b ? (a[0] ? b.toString(a[0].encoding || a[0]) : b) : read(p, ...a);
};
fs.statSync = (p, ...a) => {
  const b = mem[String(p)];
  return b ? { size: b.length, isFile: () => true } : stat(p, ...a);
};
