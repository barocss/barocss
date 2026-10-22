// G18.2: the repeating UV shader demos' hosts on the WebGPU viewer — each preset drawn (a pattern, not a flat colour),
// a control changing the frame, a refused source leaving the accepted frame, the report naming the WebGPU host.
//   node scripts/build-advanced-shader.mjs && node scripts/build-reusable-shader.mjs
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node scripts/check-shader-hosts-webgpu.mjs [out-dir]
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..'), out = process.argv[2] ?? null;
const generated = resolve(app, 'docs/.vitepress/generated');
const HOSTS = { advanced: ['advanced-shader', 'caustics-shader', 'weave-shader', 'contour-shader', 'halftone-shader'], reusable: ['reusable-shader'] };
const presets = Object.fromEntries(await Promise.all(Object.values(HOSTS).flat().map(async n => [n, JSON.parse(await readFile(resolve(app, `scripts/snippets/${n}.json`), 'utf8'))])));
const page = '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}canvas{display:block;width:640px;height:420px}</style>';
const server = createServer(async (req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
  const m = /^\/(advanced|reusable)-shader\.js$/.exec(req.url);
  if (m) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(resolve(generated, `${m[1]}-shader.js`))); return; }
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const { chromium } = createRequire(resolve(process.env.PW_DIR, 'package.json'))('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--enable-unsafe-webgpu'] });
const results = [];
try {
  const p = await browser.newPage({ viewport: { width: 640, height: 420 }, deviceScaleFactor: 1 });
  const errors = []; p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`http://127.0.0.1:${server.address().port}/`);
  if (out) await mkdir(out, { recursive: true });
  for (const [host, names] of Object.entries(HOSTS)) for (const name of names) {
    const preset = presets[name];
    await p.evaluate(() => { document.body.replaceChildren(); const c = document.createElement('canvas'); c.width = 640; c.height = 420; c.id = 'c'; document.body.append(c); });
    const shot = async () => { await p.waitForTimeout(250); return p.locator('#c').screenshot(); };
    const r = await p.evaluate(async ([host, source]) => {
      const m = await import(`/${host}-shader.js`);
      window.__host = await m.createAdvancedShaderExample(document.getElementById('c'), source);
      return window.__host.report();
    }, [host, preset.source]);
    const before = await shot();
    const control = preset.controls[preset.controls.length > 1 ? 1 : 0], to = control.default === control.max ? control.min : control.max;
    const moved = await p.evaluate(([n, v]) => window.__host.setUniform(n, v), [control.name, to]);
    const after = await shot();
    // A source refused: the error, the accepted frame kept.
    const refused = await p.evaluate(() => { try { window.__host.update('@shader #broken { @fragment { color: nope; } }'); return null; } catch (e) { return e.code ?? String(e); } });
    const kept = await shot();
    const stats = await p.evaluate(async ([a, b, c]) => {
      const decode = async b64 => { const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()), cv = new OffscreenCanvas(img.width, img.height), g = cv.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const [x, y, z] = await Promise.all([a, b, c].map(decode));
      let lo = 255, hi = 0, changed = 0, same = 0;
      for (let i = 0; i < x.length; i += 4) { for (let k = 0; k < 3; k++) { lo = Math.min(lo, x[i + k]); hi = Math.max(hi, x[i + k]); } if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 6) changed++; if (y[i] === z[i] && y[i + 1] === z[i + 1] && y[i + 2] === z[i + 2]) same++; }
      return { spread: hi - lo, changed: changed / (x.length / 4), kept: same / (x.length / 4) };
    }, [before.toString('base64'), after.toString('base64'), kept.toString('base64')]);
    await p.evaluate(() => window.__host.dispose());
    if (out) await writeFile(resolve(out, `${name}.png`), before);
    const row = { name, host, backend: r.backend, shaderId: r.shaderId, controls: r.controls.map(c => c.name), control: `${control.name} → ${to}`, uniform: moved.uniforms[control.name], refused, ...stats };
    results.push(row);
    assert.match(r.backend, /WebGPU/, name);
    assert.deepEqual(r.controls.map(c => c.name), preset.controls.map(c => c.name), `${name}: its controls`);
    assert.ok(stats.spread > 40, `${name}: a pattern ${JSON.stringify(row)}`);
    assert.ok(stats.changed > 0.02, `${name}: the control changes the frame ${JSON.stringify(row)}`);
    assert.ok(refused && stats.kept > 0.999, `${name}: refused, the frame kept ${JSON.stringify(row)}`);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', results }));
} finally { await browser.close(); server.close(); }
