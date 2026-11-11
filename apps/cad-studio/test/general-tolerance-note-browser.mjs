// Desktop acceptance for #2368. Run under the heavy gate with D702_SOURCE_FROZEN=1.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--baseline', '--fixed'].includes(mode));
await mkdir(output, { recursive: true });
const modelPath = join(import.meta.dirname, 'fixtures/bracket.bcad');
const model = JSON.parse(await readFile(modelPath));
model.nodes[0].max = [25.4, 12.7];
model.nodes[1].height = 6.35;
const prefix = 'UNLESS OTHERWISE STATED';
const suggested = `${prefix}:\nLINEAR ±0.2${mode === '--fixed' ? ' mm' : ''} · ANGULAR ±0.5°`;
const ordinary = { id: 'n1', text: 'REFERENCE ONLY · LINEAR ±0.2', at: [25, 35], leader: { view: 'top', at: [5, 5] } };
const legacy = { id: 'old', text: `${prefix}:\nLINEAR ±0.2 · ANGULAR ±0.5°`, at: [30, 55] };
const handwritten = { id: 'manual', text: `${prefix}: SHOP RULE ±0.15 po`, at: [30, 75] };
const frame = { id: 'flatness', characteristic: 'flatness', value: 0.05, datums: [], view: 'top', place: [5, 23] };
const edge = 'n1.side0|n1.top';
const end = x => ({ edge, at: 'end', near: [x, 0, 6.35] });
const width = { id: 'width', kind: 'linear', view: 'front', a: end(0), b: end(25.4), orient: 'horizontal', place: [12.7, 12], tol: { kind: 'symmetric', value: 0.1 } };
const drawing = { scope: { kind: 'part' }, sheet: 'A3', projection: 'third', scale: 1, hidden: false,
  title: 'General tolerance units', views: ['front', 'top'], dimensions: [width], frames: [frame], notes: [ordinary] };
const inputs = {
  mm: drawing,
  inch: { ...drawing, units: 'inch' },
  'mm-dual': { ...drawing, dual: true },
  'inch-dual-geometric': { ...drawing, units: 'inch', dual: true, tolerancing: 'geometric' },
  legacy: { ...drawing, units: 'inch', notes: [ordinary, legacy, handwritten] },
};
const files = new Map();
for (const [label, settings] of Object.entries(inputs)) {
  const path = join(output, label + '.bcad');
  await writeFile(path, JSON.stringify({ ...model, drawing: settings }), { flag: 'wx' });
  files.set(label, path);
}

const oracle = join(import.meta.dirname, 'general-tolerance-note-reader.py');
const f = await createFlow({
  name: 'general-tolerance-note', envFrozen: 'D702_SOURCE_FROZEN', output,
  qualification: 'Exact note and drawing unit custody through Studio acceptance, unit switches, history, Save and fresh Open, and independent SVG/DXF readback.',
  initialFiles: [import.meta.filename, modelPath, oracle, ...files.values()], oracleSource: await readFile(oracle, 'utf8'),
  extraFrozen: ['packages/barocss-cad-model/src/drawing/tolerance.ts', 'packages/barocss-cad-model/src/drawing/standard.ts',
    'packages/barocss-cad-model/src/io/svg.ts', 'packages/barocss-cad-model/src/io/dxf.ts',
    'apps/cad-studio/src/ui/drawing/TolerancingList.tsx', 'apps/cad-studio/src/ui/drawing/SheetSettings.tsx'],
  limits: ['Capture actual local bytes before browser delivery. Legacy notes remain literal. No PDF or manufacturing qualification.'],
});
const start = f.start;
f.start = async () => {
  await start();
  const newContext = f.browser.newContext.bind(f.browser);
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
      return route.abort();
    });
    await context.addInitScript(() => {
      const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click, blobs = new Map();
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob instanceof Blob) blobs.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = blobs.get(this.href), name = this.download;
        if (!blob || !/\.(bcad|svg|dxf)$/.test(name)) return click.call(this);
        window.__toleranceFile = blob.arrayBuffer().then(bytes => ({ name, bytes: [...new Uint8Array(bytes)] }));
        blobs.delete(this.href);
      };
    });
    return context;
  };
};

const button = name => f.page.getByRole('button', { name, exact: true });
const units = () => f.page.getByLabel('Drawing units', { exact: true });
const dual = () => f.page.getByLabel('Dual units', { exact: true });
const suggestion = () => f.page.locator('[aria-label="Tolerance suggestions"] .dw-issue').filter({ hasText: 'A general tolerance note' });
const sheet = 'svg[aria-label="Drawing sheet"]';
const timeout = 60000;
async function open(path) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(path);
  await f.page.waitForFunction(() => window.__studioDoc?.drawing?.title === 'General tolerance units', null, { timeout });
  await f.ready();
  await button('Drawing').click();
  await f.page.waitForFunction(() => !!window.__studioDrawing?.(), null, { timeout });
}
async function capture(command, label) {
  await f.page.evaluate(() => { window.__toleranceFile = null; });
  await button(command).click();
  await f.page.waitForFunction(() => !!window.__toleranceFile, null, { timeout });
  const { name, bytes } = await f.page.evaluate(() => window.__toleranceFile);
  const file = join(output, label + '-' + name), buffer = Buffer.from(bytes);
  await writeFile(file, buffer, { flag: 'wx' });
  f.report.files.push({ label, name, sha256: sha256(buffer) });
  return { file, buffer };
}
async function save(label) {
  const { file, buffer } = await capture('Save', label), doc = await f.doc();
  assert.deepEqual(JSON.parse(buffer), doc);
  return { file, doc };
}
async function accept(label, all = false) {
  f.phase = label;
  const before = await f.doc();
  await suggestion().waitFor();
  assert.match(await suggestion().textContent(), /linear ±0\.2 mm, angular ±0\.5°/);
  assert.match(await suggestion().getAttribute('title'), /an estimate.*not from a standard/);
  assert.equal(before.drawing.notes.length, 1);
  if (all) await button('Accept all suggestions').click();
  else await suggestion().getByRole('button', { name: /^Accept:/ }).click();
  await f.changed(before);
  const accepted = await f.doc();
  assert.deepEqual(accepted.drawing.notes.map(n => n.text), [ordinary.text, suggested]);
  assert.deepEqual(accepted.drawing.notes[0], ordinary);
  assert.deepEqual(accepted.drawing.frames, before.drawing.frames);
  assert.deepEqual(accepted.drawing.dimensions, before.drawing.dimensions);
  if (!all) assert.deepEqual(accepted, { ...before, drawing: { ...before.drawing, notes: accepted.drawing.notes } });
  assert.equal(await suggestion().count(), 0);
  return accepted;
}
async function changeSettings(action, keys) {
  const before = await f.doc();
  await action();
  await f.changed(before);
  const after = await f.doc(), next = { ...before.drawing };
  for (const [key, value] of Object.entries(keys)) {
    if (value === undefined) delete next[key]; else next[key] = value;
  }
  assert.deepEqual(after, { ...before, drawing: next });
}
async function check(label, printedUnits, nominal, generated = true, withFiles = true) {
  f.phase = label;
  const doc = await f.doc(), geometry = { ...doc };
  delete geometry.drawing;
  assert.deepEqual(geometry, model);
  const body = (await f.bodies()).bodies;
  assert.equal(body.length, 1);
  assert.ok(Math.abs(body[0].volume - 2048.383) < 1e-8, JSON.stringify(body));
  assert.ok(body[0].centroid.every((v, i) => Math.abs(v - [12.7, 6.35, 3.175][i]) < 1e-8));
  const title = f.page.locator(`${sheet} g.title`);
  assert.equal(await title.getByText(printedUnits, { exact: true }).count(), 1);
  const resolved = await f.page.evaluate(() => window.__studioDrawing().dimensions.find(d => d.id === 'width'));
  assert.ok(Math.abs(resolved.value - 25.4) < 1e-8);
  const note = generated ? doc.drawing.notes.find(n => n.text === suggested) : undefined;
  if (generated) assert.ok(note);
  const actual = Object.fromEntries(doc.drawing.notes.map(n => [n.id, n.text]));
  for (const [id, text] of Object.entries(actual)) {
    const view = f.page.locator(`${sheet} g.note[data-dim="${id}"] text`);
    assert.deepEqual(await view.allTextContents(), text.split('\n'));
    assert.ok(await view.evaluateAll(marks => marks.every(mark => {
      const b = mark.getBBox();
      return b.x >= 0 && b.y >= 0 && b.x + b.width <= 420 && b.y + b.height <= 297;
    })), `Note ${id} fits on paper`);
  }
  f.report.observations.push({ label, printedUnits, nominal, note, widthMM: resolved.value, volumeMM3: body[0].volume });
  await f.persist();
  if (withFiles) {
    const svg = await capture('Export SVG', label), dxf = await capture('Export DXF', label);
    await f.runOracle({ svg: svg.file, dxf: dxf.file, units: printedUnits, nominal, notes: actual,
      generated: note?.id, explicit: mode === '--fixed' && generated }, label);
  }
}

await f.run(async () => {
  f.phase = 'open mm source';
  await open(files.get('mm'));
  const original = await f.doc();
  await suggestion().getByText('Estimate', { exact: true }).click();
  await f.page.keyboard.press('Escape');
  await button('Model').click();
  await f.same(original);
  assert.equal(await f.page.locator('[aria-label="Unsaved changes"]').count(), 0);
  await button('Drawing').click();
  const accepted = await accept('accept in mm');
  await check('mm-direct', 'mm', '25.4');
  await changeSettings(() => units().selectOption('inch'), { units: 'inch' });
  await check('inch-after-mm', 'inch', '1');
  await f.snapshot('inch-after-mm');
  if (mode === '--baseline') assert.fail('The accepted note states ±0.2 with no unit on an inch drawing in Studio, SVG and DXF');

  await f.undo();
  await f.same(accepted);
  await f.undo();
  await f.same(original);
  await suggestion().waitFor();
  await f.redo();
  await f.same(accepted);
  await f.redo();
  await check('inch-redo', 'inch', '1', true, false);

  await changeSettings(() => dual().check(), { dual: true });
  await check('inch-dual-switch', 'inch [mm]', '1 [25.4]');
  const decimals = f.page.getByLabel('Decimals in inch', { exact: true });
  await decimals.locator('xpath=ancestor::details').locator('summary').click();
  for (const value of [0, 2, 6]) {
    await changeSettings(() => decimals.fill(String(value)), { precision: { inch: value } });
    await check(`inch-precision-${value}`, 'inch [mm]', '1 [25.4]', true, false);
  }
  await changeSettings(() => units().selectOption('mm'), { units: undefined });
  await check('mm-dual-switch', 'mm [inch]', '25.4 [1]');
  await changeSettings(() => dual().uncheck(), { dual: undefined });
  const mm = await save('saved-mm');
  await open(mm.file);
  await f.same(mm.doc);
  await check('fresh-mm', 'mm', '25.4');

  await open(files.get('inch'));
  await accept('accept in inch');
  await check('inch-direct', 'inch', '1');
  const inch = await save('saved-inch');
  await open(inch.file);
  await f.same(inch.doc);
  await check('fresh-inch', 'inch', '1');
  await changeSettings(() => units().selectOption('mm'), { units: undefined });
  await check('mm-after-inch', 'mm', '25.4');

  await open(files.get('mm-dual'));
  await accept('accept all in mm dual', true);
  await check('mm-dual-all', 'mm [inch]', '25.4 [1]');
  await open(files.get('inch-dual-geometric'));
  assert.equal(await f.page.getByLabel('Tolerancing', { exact: true }).inputValue(), 'geometric');
  await accept('accept all in geometric mode', true);
  await check('inch-dual-geometric-all', 'inch [mm]', '1 [25.4]');
  await f.snapshot('inch-dual-geometric');

  await open(files.get('legacy'));
  assert.equal(await suggestion().count(), 0);
  await changeSettings(() => units().selectOption('mm'), { units: undefined });
  await changeSettings(() => dual().check(), { dual: true });
  const savedLegacy = await save('saved-legacy');
  await open(savedLegacy.file);
  await f.same(savedLegacy.doc);
  assert.deepEqual((await f.doc()).drawing.notes, [ordinary, legacy, handwritten]);
  assert.equal(await suggestion().count(), 0);
  await check('legacy-reopen', 'mm [inch]', '25.4 [1]', false);
  await f.snapshot('legacy-reopen');
  assert.deepEqual(f.report.downloads, []);
});
