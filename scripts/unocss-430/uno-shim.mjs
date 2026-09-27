// #430: serve the UnoCSS browser runtime from jsDelivr without saving it to disk (like scripts/rerun-383/twb-shim.mjs).
// Preload with `node --import ./scripts/unocss-430/uno-shim.mjs` and set UNO_JS=/__uno_mem__/runtime.js.
// That path returns preset-wind4.global.js + core.global.js of @unocss/runtime@UNO_VERSION (default 66.10.5),
// i.e. the documented "core + preset" CDN setup (presets load before the core).
import fs from 'node:fs';

const V = process.env.UNO_VERSION || '66.10.5';
const get = async (f) => Buffer.from(await (await fetch(`https://cdn.jsdelivr.net/npm/@unocss/runtime@${V}/${f}`)).arrayBuffer());
const buf = Buffer.concat([await get('preset-wind4.global.js'), Buffer.from('\n'), await get('core.global.js')]);
const P = '/__uno_mem__/runtime.js';
const read = fs.readFileSync, stat = fs.statSync, exists = fs.existsSync;
fs.readFileSync = (p, ...a) => (String(p) === P ? (a[0] ? buf.toString(a[0].encoding || a[0]) : buf) : read(p, ...a));
fs.statSync = (p, ...a) => (String(p) === P ? { size: buf.length, isFile: () => true } : stat(p, ...a));
fs.existsSync = (p) => (String(p) === P ? true : exists(p));
