// Long-session memory: about 200 edits of the starter plate's hole (its diameter in the feature editor),
// with hover and orbit between them, measuring the main thread's and the engine worker's JS heap (after
// a GC) and the live GPU buffers and textures before, halfway and after. Opt-in:
//   PW_DIR=/path/to/node_modules/playwright [CHROME=...] [EDITS=200] node test/memory-session.mjs
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..'), EDITS = Number(process.env.EDITS ?? 200);
if (!process.env.PW_DIR) { console.error('Set PW_DIR to a Playwright package directory.'); process.exit(2); }
const { chromium } = createRequire(join(process.env.PW_DIR, 'package.json'))('playwright');
const { createServer } = await import('vite');
const server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { port: 52051, strictPort: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// Live GPU buffers and textures: created less destroyed (a dropped one the GC collects is not counted back).
await page.addInitScript(() => {
  const w = window; w.__gpu = { buffers: 0, textures: 0 };
  if (!w.GPUDevice) return;
  const cb = GPUDevice.prototype.createBuffer, ct = GPUDevice.prototype.createTexture, db = GPUBuffer.prototype.destroy, dt = GPUTexture.prototype.destroy;
  GPUDevice.prototype.createBuffer = function (d) { const b = cb.call(this, d); w.__gpu.buffers++; return b; };
  GPUDevice.prototype.createTexture = function (d) { const t = ct.call(this, d); w.__gpu.textures++; return t; };
  GPUBuffer.prototype.destroy = function () { if (!this.__gone) { this.__gone = true; w.__gpu.buffers--; } return db.call(this); };
  GPUTexture.prototype.destroy = function () { if (!this.__gone) { this.__gone = true; w.__gpu.textures--; } return dt.call(this); };
});
const cdp = await page.context().newCDPSession(page), bcdp = await browser.newBrowserCDPSession();
/** The worker's heap: through the browser session, attached to the worker target (legacy message routing). */
async function workerHeap() {
  const { targetInfos } = await bcdp.send('Target.getTargets');
  const t = targetInfos.find(x => x.type === 'worker' && /engine\.worker/.test(x.url)); if (!t) return null;
  const { sessionId } = await bcdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: false });
  const call = (id, method) => new Promise(res => {
    const on = e => { if (e.sessionId !== sessionId) return; const m = JSON.parse(e.message); if (m.id === id) { bcdp.off('Target.receivedMessageFromTarget', on); res(m.result); } };
    bcdp.on('Target.receivedMessageFromTarget', on);
    bcdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method }) });
  });
  await call(1, 'HeapProfiler.collectGarbage');
  const r = await call(2, 'Runtime.getHeapUsage');
  await bcdp.send('Target.detachFromTarget', { sessionId });
  return r.usedSize;
}
async function sample(label) {
  await page.waitForTimeout(600);
  await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
  const main = (await cdp.send('Runtime.getHeapUsage')).usedSize, worker = await workerHeap(), gpu = await page.evaluate(() => window.__gpu);
  const undo = await page.evaluate(() => window.__studioDoc?.nodes.length);
  return { label, mainMB: +(main / 1048576).toFixed(1), workerMB: worker === null ? null : +(worker / 1048576).toFixed(1), buffers: gpu.buffers, textures: gpu.textures, nodes: undo };
}
const rows = [];
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? '') && /Hole Ø8/.test(document.querySelector('.outliner')?.textContent ?? ''), null, { timeout: 30000 });
  const box = await page.locator('canvas.vp-canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const idle = () => page.waitForFunction(() => !/Computing/.test(document.querySelector('.corner-left')?.textContent ?? ''), null, { timeout: 30000 });
  const hoverAndOrbit = async k => {
    for (let i = 0; i < 6; i++) { await page.mouse.move(cx - 200 + 60 * i, cy - 30 + 10 * (i % 3)); await page.waitForTimeout(10); }
    if (k % 5 === 0) { await page.mouse.move(cx, cy); await page.mouse.down(); for (let i = 0; i < 6; i++) await page.mouse.move(cx + 10 * i, cy + 2 * i); await page.mouse.up(); }
  };
  rows.push(await sample('start'));
  const field = page.locator('.node-editor .field', { has: page.locator('span:text-is("Diameter")') }).locator('input');
  for (let k = 1; k <= EDITS; k++) {
    await page.locator('.history .hs', { hasText: 'Hole' }).click();
    await field.fill(''); await field.fill(String(6 + (k % 40) / 10));
    await page.locator('.node-editor button', { hasText: 'Apply' }).click(); await idle();
    await hoverAndOrbit(k);
    if (k === Math.floor(EDITS / 2)) rows.push(await sample(`after ${k} edits`));
  }
  rows.push(await sample(`after ${EDITS} edits`));
  // Parts placed and removed again: their meshes (and GPU buffers) go with them.
  const CYCLES = Math.max(1, Math.round(EDITS / 10));
  for (let k = 0; k < CYCLES; k++) {
    await page.setInputFiles('input[aria-label="Part file"]', join(root, 'test/fixtures/bracket.bcad'));
    await page.waitForFunction(() => /Bodies\s*1/.test(document.querySelector('[aria-label="Instance"]')?.textContent ?? ''), null, { timeout: 15000 });
    await hoverAndOrbit(5);
    await page.click('[aria-label="Instance"] button:text-is("Remove")');
    await page.waitForFunction(() => !(window.__studioDoc.instances ?? []).length, null, { timeout: 5000 }); await idle();
  }
  rows.push(await sample(`after ${CYCLES} insert/remove`));
} finally { await browser.close(); await server.close(); }
for (const r of rows) console.log(`${r.label.padEnd(18)} main ${String(r.mainMB).padStart(6)} MB  worker ${String(r.workerMB).padStart(6)} MB  GPU buffers ${String(r.buffers).padStart(4)}  textures ${String(r.textures).padStart(3)}`);
