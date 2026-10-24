// G15d.1 in a real browser's WebGPU: the output pass's AgX tone map beside ACES and none, the colour grading (white
// balance, saturation, contrast) and the vignette — on an unlit square in front of a flat background.
//   CHROME=/path/to/chrome PW_DIR=/path/to/node_modules/playwright node --test tests/viewer-post-browser.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/viewer');
const page = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#000}canvas{display:block;width:320px;height:240px}</style><canvas id="c"></canvas>`;

async function serve() {
  const files = new Map((await readdir(dist, { recursive: true })).filter(f => f.endsWith('.js')).map(f => [`/viewer/${f.split(path.sep).join('/')}`, path.join(dist, f)]));
  files.set('/core/barocss-error.js', path.join(dist, '../core/barocss-error.js'));
  const server = createServer(async (req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(page); return; }
    const file = files.get(req.url ?? '');
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(await readFile(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

test('the output pass: AgX, grading and the vignette (G15d.1)', { timeout: 120000 }, async t => {
  if (!process.env.CHROME || !process.env.PW_DIR) { t.skip('CHROME and PW_DIR are required'); return; }
  const { chromium } = createRequire(path.join(process.env.PW_DIR, 'package.json'))('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: (process.env.VIEWER_ADAPTER === 'swiftshader' ? ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] : ['--enable-unsafe-webgpu']) });
  const errors = [];
  try {
    const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
    p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(server.url + '/');
    if (!(await p.evaluate(async () => !!(await navigator.gpu?.requestAdapter())))) { t.skip('no WebGPU adapter'); return; }

    const r = await p.evaluate(async () => {
      const api = await import('/viewer/index.js');
      const canvas = document.getElementById('c');
      const viewer = await api.createViewer(canvas, { pixelRatio: 1, background: '#808080', camera: { position: [0, -10, 0], target: [0, 0, 0], up: [0, 0, 1] } });
      // A square facing the camera, a third of the frame: a saturated red, unlit (its colour is what the pass gets).
      viewer.add({ positions: [-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], indices: [0, 1, 2, 0, 2, 3] }, { name: 'square', material: { color: '#e01010', unlit: true, doubleSided: true } });
      viewer.fit({ min: [-3, 0, -3], max: [3, 0, 3] });
      const at = (img, x, y) => { const i = (Math.round(y) * img.width + Math.round(x)) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
      const shot = async env => {
        viewer.environment = env; await viewer.frame();
        const img = await viewer.capture(), w = img.width, h = img.height;
        return { centre: at(img, w / 2, h / 2), corner: at(img, 3, 3), edge: at(img, w / 2, 3), near: at(img, w / 2 - w / 4, h / 2) };
      };
      return {
        plain: await shot({ exposure: 1, toneMapping: 'none' }),
        bright: { none: await shot({ exposure: 6, toneMapping: 'none' }), aces: await shot({ exposure: 6, toneMapping: 'aces' }), agx: await shot({ exposure: 6, toneMapping: 'agx' }) },
        agx1: await shot({ exposure: 1, toneMapping: 'agx' }),
        vignette: await shot({ toneMapping: 'none', vignette: { amount: 0.8, size: 0.3, softness: 0.6 } }),
        warm: await shot({ toneMapping: 'none', grading: { temperature: 0.8 } }),
        cool: await shot({ toneMapping: 'none', grading: { temperature: -0.8 } }),
        grey: await shot({ toneMapping: 'none', grading: { saturation: 0 } }),
        contrast: await shot({ toneMapping: 'none', grading: { contrast: 1.6 } }),
        neutral: await shot({ toneMapping: 'none', grading: {} }),
      };
    });
    t.diagnostic(JSON.stringify(r));
    const close = (a, b, tol = 2) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
    // Off: the background flat to its corners, the square its own colour.
    assert.ok(close(r.plain.corner, [128, 128, 128]) && close(r.plain.centre, [224, 16, 16]), 'no post: the colours as given');
    // A grading of defaults changes nothing.
    assert.ok(close(r.neutral.corner, r.plain.corner) && close(r.neutral.centre, r.plain.centre), 'the default grading is the identity');
    // Six times over: none clips red and keeps it pure; ACES clips nearly as hard; AgX turns it towards white (the other
    // channels lifted) and keeps red below full.
    const [, gNone] = r.bright.none.centre, [, gAces] = r.bright.aces.centre, [rAgx, gAgx] = r.bright.agx.centre;
    assert.ok(r.bright.none.centre[0] === 255 && gNone < 120, `none: ${r.bright.none.centre}`);
    assert.ok(gAgx > gAces + 20 && gAgx > gNone + 20 && rAgx > 200, `AgX desaturates bright colour to white: ${r.bright.agx.centre} vs ACES ${r.bright.aces.centre}`);
    // At exposure 1, AgX softens the saturated red (a lower red, lifted others); the background (sRGB as given) is not
    // tone-mapped.
    assert.ok(r.agx1.centre[0] < r.plain.centre[0] && r.agx1.centre[1] > r.plain.centre[1] + 15, `AgX at 1: ${r.agx1.centre}`);
    assert.ok(close(r.agx1.corner, r.plain.corner), 'the background is not tone-mapped');
    // The vignette: the corners darker than the middle of the top edge, the centre unchanged.
    assert.ok(r.vignette.corner[0] < r.vignette.edge[0] - 15 && r.vignette.edge[0] <= 129, `vignette: corner ${r.vignette.corner}, edge ${r.vignette.edge}`);
    assert.ok(close(r.vignette.centre, r.plain.centre), 'the vignette leaves the centre');
    // White balance: warm lifts red over blue, cool the reverse, on the grey background.
    assert.ok(r.warm.corner[0] > r.warm.corner[2] + 12 && r.cool.corner[2] > r.cool.corner[0] + 12, `warm ${r.warm.corner}, cool ${r.cool.corner}`);
    // Saturation 0: the red square grey.
    assert.ok(Math.max(...r.grey.centre) - Math.min(...r.grey.centre) <= 3, `saturation 0: ${r.grey.centre}`);
    // Contrast: the red's dark channels darker, its bright one brighter; mid grey about where it was.
    assert.ok(r.contrast.centre[1] <= r.plain.centre[1] && r.contrast.centre[0] > r.plain.centre[0], `contrast: ${r.contrast.centre}`);
    assert.ok(Math.abs(r.contrast.corner[0] - 128) < 12, `contrast keeps mid grey: ${r.contrast.corner}`);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close(); await server.close();
  }
});
