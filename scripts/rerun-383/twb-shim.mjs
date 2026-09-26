// #383: serve @tailwindcss/browser from the jsDelivr CDN without saving it to disk.
// Preload with `node --import ./scripts/rerun-383/twb-shim.mjs` and set TWB_DIR=/__twb_mem__.
// Reads of /__twb_mem__/dist/index.global.js return the CDN bytes (TWB_VERSION, default 4.1.13).
import fs from 'node:fs';

const V = process.env.TWB_VERSION || '4.1.13';
const url = `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@${V}/dist/index.global.js`;
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
const P = '/__twb_mem__/dist/index.global.js';
const read = fs.readFileSync, stat = fs.statSync;
fs.readFileSync = (p, ...a) => (String(p) === P ? (a[0] ? buf.toString(a[0].encoding || a[0]) : buf) : read(p, ...a));
fs.statSync = (p, ...a) => (String(p) === P ? { size: buf.length, isFile: () => true } : stat(p, ...a));
