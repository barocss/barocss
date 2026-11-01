// D414: real settings UI plus exact document snapshot -> frozen Model producer -> independent reader.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
import { INSPECTOR_SOURCE } from './drawing-dimstyle-producer.mjs';

const file = resolve(process.argv[3] ?? ''); assert.ok(process.argv[3]);
const reader = resolve('apps/cad-studio/test/drawing-dimstyle-reader.py');
const f = await createFlow({
  name: 'drawing-dimstyle', envFrozen: 'DRAWING_DIMSTYLE_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'D414_DIMSTYLE_DEFAULTS', inspectorSource: INSPECTOR_SOURCE,
  initialFiles: ['apps/cad-studio/test/drawing-dimstyle-browser.mjs', 'apps/cad-studio/test/drawing-dimstyle-producer.mjs', reader, file],
  requiredFrozen: ['packages/barocss-cad/src/io/dxf-writer.ts', 'packages/barocss-cad-model/src/io/dxf.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts'],
  limits: [
    'Actual Studio settings and Undo/Redo, then exact accepted native snapshot through the frozen Model producer and existing independent ezdxf reader.',
    'Export DXF button/download/Save NOT_RUN. Explicit DIMENSION labels and anonymous display blocks remain authoritative; external regeneration appearance is not accepted.',
    'One box with horizontal/vertical linear dimensions; no short-arrow, dual/fit overhaul or broad standards certification.',
  ],
});
const SHEET = 'svg[aria-label="Drawing sheet"]';
let model;
const ready = () => f.page.waitForFunction(() => !!document.querySelector('svg[aria-label="Drawing sheet"]') && window.__studioDrawing?.()?.dimensions.length === 2);
async function read(label, standard, units = 'mm', dual = false) {
  await f.page.waitForFunction(expected => {
    const drawing = window.__studioDoc?.drawing;
    const text = document.querySelector('svg[aria-label="Drawing sheet"] g.dimension text');
    return drawing?.standard === expected.standard && (drawing.units ?? 'mm') === expected.units && !!drawing.dual === expected.dual
      && Number(text?.getAttribute('font-size')) === (expected.standard === 'asme' ? 3 : 3.5);
  }, { standard, units, dual });
  await ready();
  const doc = await f.doc(), { drawing, ...geometry } = doc;
  assert.deepEqual(geometry, model); assert.equal(drawing.standard, standard);
  const dom = await f.page.evaluate(() => ({ svg: document.querySelector('svg[aria-label="Drawing sheet"]').outerHTML,
    dimensions: [...document.querySelectorAll('svg[aria-label="Drawing sheet"] g.dimension')].map(g => ({ id: g.getAttribute('data-dim'), texts: [...g.querySelectorAll('text')].map(t => ({ text: t.textContent, size: t.getAttribute('font-size') })) })) }));
  await writeFile(join(f.output, label + '.svg'), dom.svg);
  const produced = await f.inspect(label, doc, { output: f.output, label });
  assert.deepEqual(produced.settings, drawing);
  const run = spawnSync('/Users/user/.cache/barocss-ezdxf/bin/python', ['-I', '-B', reader], {
    input: JSON.stringify(produced), encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  await writeFile(join(f.output, label + '-reader.json'), run.stdout ?? '');
  await writeFile(join(f.output, label + '-reader.stderr.txt'), run.stderr ?? '');
  assert.equal(run.status, 0, run.stderr);
  const independent = JSON.parse(run.stdout); assert.equal(independent.status, 'PASS');
  const labels = dom.dimensions.map(group => group.texts.map(text => text.text).join(' '));
  for (const file of independent.files) assert.deepEqual(file.dimensions.map(dimension => dimension.label), labels, 'independent DXF labels match the actual DOM');
  f.report.observations.push({ label, actualSettings: drawing, domDimensions: dom.dimensions, snapshotProducerReader: independent });
  return doc;
}
await f.run(async () => {
  const fonts = { stylesheets: 0, assets: 0 }, original = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await original(...args);
    await context.route('https://fonts.googleapis.com/**', route => { fonts.stylesheets++; return route.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
    await context.route('https://fonts.gstatic.com/**', route => { fonts.assets++; return route.fulfill({ status: 204, body: '' }); });
    return context;
  };
  try { await f.newPage(); } finally { f.browser.newContext = original; }
  f.phase = 'Open authored dimensions and choose ASME';
  await f.openFile(file, 2); await f.ready();
  const { drawing: _drawing, ...geometry } = await f.doc(); void _drawing; model = geometry;
  await f.page.click('.mode button:text-is("Drawing")'); await ready();
  await f.page.getByLabel('Drawing standard', { exact: true }).selectOption('asme');
  const asme = await read('01-asme-mm', 'asme'); await f.snapshot('01-asme-mm');
  f.phase = 'ISO control and exact Undo/Redo';
  await f.page.getByLabel('Drawing standard', { exact: true }).selectOption('iso');
  const iso = await read('02-iso-mm', 'iso');
  await f.undo(); await f.same(asme); await read('03-undo-asme', 'asme');
  await f.redo(); await f.same(iso); await read('04-redo-iso', 'iso');
  f.phase = 'ASME inch and dual display retain millimetre coordinates';
  await f.page.getByLabel('Drawing standard', { exact: true }).selectOption('asme');
  await f.page.getByLabel('Drawing units', { exact: true }).selectOption('inch');
  await read('05-asme-inch', 'asme', 'inch');
  await f.page.getByLabel('Dual units', { exact: true }).check();
  await read('06-asme-dual', 'asme', 'inch', true); await f.snapshot('06-asme-dual');
  assert.equal(fonts.assets, 0); assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ fonts, geometryUnchanged: true, undoRedo: 'PASS', outboundExportAndSave: 'NOT_RUN' });
});
