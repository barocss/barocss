// D408: real authored point tolerance and unit controls. Read in-page SVG; no Save/export/download.
import assert from 'node:assert/strict';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';
const output = resolve(process.argv[2] ?? ''); assert.ok(process.argv[2], 'artifact output directory required');
await mkdir(output, { recursive: true }); const fixture = join(output, 'box30.bcad');
await copyFile(join(import.meta.dirname, 'fixtures/bracket.bcad'), fixture);
const SHEET = 'svg[aria-label="Drawing sheet"]';
const f = await createFlow({ name: 'drawing-tolerance-printable', envFrozen: 'DRAWING_TOLERANCE_PRINTABLE_SOURCE_FROZEN', output,
  qualification: 'D408_DRAWING_TOLERANCE_PRINTABILITY',
  inspectorSource: "export { buildSheet } from '@barocss/cad-model/drawing/sheet'; export { drawingIssues } from '@barocss/cad-model/drawing/issues'; export { presetFor } from '@barocss/cad-model/drawing/standard';",
  initialFiles: ['apps/cad-studio/test/drawing-tolerance-printable-browser.mjs', 'apps/cad-studio/test/fixtures/bracket.bcad', fixture],
  requiredFrozen: ['packages/barocss-cad-model/src/drawing/standard.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/drawing/issues.ts', 'apps/cad-studio/src/ui/drawing/ToleranceEditor.tsx', 'apps/cad-studio/src/ui/drawing/SheetSettings.tsx'],
  limits: ['One linear width on a30x12x6mm box, authored through real tolerance fields; generic dimensions/fits/PMI and standards acceptance are not claimed.', 'Sheet markup is read from the actual DOM and preserved locally; outbound SVG/PDF/DXF exports, Save and downloads are NOT_RUN.', 'Primary inch point interval endpoint is checked with literal decimal integer arithmetic; no product formatting imports.', 'Numeric/model regression and consumer policy qualification are separate; no new dependency, external fixture or paid call.'] });
let widthId, widthIndex, model;
const sheetReady = () => f.page.waitForFunction(() => !!window.__studioDrawing?.() && !!document.querySelector('svg[aria-label="Drawing sheet"]'), null, { timeout: 60000 });
const widthRow = () => f.page.locator('.dw-dims .dw-dim').nth(widthIndex);
async function checkModel() { const d = await f.doc(), { drawing: _drawing, ...rest } = d; void _drawing; assert.deepEqual(rest, model, 'only intended drawing settings may change'); return d; }
async function readSheet(label) {
  await sheetReady(); const state = await f.page.evaluate(id => {
    const svg = document.querySelector('svg[aria-label="Drawing sheet"]');
    const group = [...svg.querySelectorAll('[data-dim]')].find(g => g.getAttribute('data-dim') === id);
    return { svg: svg.outerHTML, widthTexts: group ? [...group.querySelectorAll('text')].map(t => t.textContent) : [], widthMarkup: group?.outerHTML, drawing: window.__studioDrawing(), issuesText: document.querySelector('[aria-label="Drawing issues"]')?.textContent };
  }, widthId);
  await writeFile(join(output, label + '.svg'), state.svg); await writeFile(join(output, label + '-drawing.json'), JSON.stringify(state, null, 2));
  const doc = await checkModel(); f.report.observations.push({ label, width: doc.drawing.dimensions.find(d => d.id === widthId), rowText: await widthRow().innerText(), widthTexts: state.widthTexts, issues: state.drawing.issues, issuesText: state.issuesText });
  return state;
}
async function toleranceField(label, value) {
  await widthRow().click(); const field = f.page.getByLabel('Tolerance ' + label, { exact: true }); await field.fill(String(value)); await field.press('Enter');
  await f.page.waitForFunction(([id, key, v]) => window.__studioDoc?.drawing?.dimensions.find(d => d.id === id)?.tol?.[key] === v, [widthId, label.toLowerCase(), value], { timeout: 60000 }); await sheetReady();
}
async function units(value) { const before = await f.doc(); await f.page.getByLabel('Drawing units', { exact: true }).selectOption(value); await f.changed(before); await sheetReady(); return checkModel(); }
async function unprintable(label) {
  await f.page.waitForFunction(id => {
    const svg = document.querySelector('svg[aria-label="Drawing sheet"]'), group = [...svg.querySelectorAll('[data-dim]')].find(g => g.getAttribute('data-dim') === id);
    return (group?.textContent.match(/tolerance not printable/g) ?? []).length === 1 && window.__studioDrawing?.().issues.some(i => i.code === 'UNIT_PRECISION');
  }, widthId, { timeout: 60000 });
  const state = await readSheet(label), row = await widthRow().innerText(), primary = row.split('[')[0];
  assert.equal((state.widthTexts.join(' ').match(/tolerance not printable/g) ?? []).length, 1); assert.match(primary, /tolerance not printable/); assert.ok(!primary.includes('/'), 'unprintable primary tolerance must not retain a numeric deviation pair'); assert.match(state.issuesText, /limits.*omitted|omit.*limits/i); return state;
}
function decimal(value) { const negative = value.startsWith('-'), plain = value.replace(/^[+-]/, ''), [whole, fraction = ''] = plain.split('.'); return { n: BigInt((whole || '0') + fraction) * (negative ? -1n : 1n), scale: 10n ** BigInt(fraction.length) }; }
function sumIsOne(a, b) { const x = decimal(a), y = decimal(b); return x.n * y.scale + y.n * x.scale === x.scale * y.scale; }
async function representable(label) {
  await f.page.waitForFunction(() => !document.querySelector('.dw-dim.sel')?.textContent.includes('not printable') && !window.__studioDrawing?.().issues.some(i => i.code === 'UNIT_PRECISION'), null, { timeout: 60000 });
  const row = await widthRow().innerText(), number = '([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))', match = new RegExp('^\\s*' + number + '\\s+' + number + '\\s*/\\s*' + number).exec(row);
  assert.ok(match, 'representable primary point keeps numeric nominal and equal deviations: ' + row); assert.ok(sumIsOne(match[1], match[2])); assert.ok(sumIsOne(match[1], match[3]));
  const state = await readSheet(label); assert.ok(!state.widthTexts.join(' ').includes('not printable')); return state;
}
await f.run(async () => {
  await f.newPage(); f.phase = 'Open and author width tolerance'; await f.openFile(fixture, 2);
  const { drawing: _drawing, ...initialModel } = await f.doc(); void _drawing; model = initialModel;
  await f.page.click('.mode button:text-is("Drawing")'); await sheetReady();
  await f.page.getByRole('button', { name: 'Auto-dimension', exact: true }).click();
  await f.page.waitForFunction(() => window.__studioDrawing?.().dimensions.length === 3, null, { timeout: 60000 });
  const dimensions = await f.page.evaluate(() => window.__studioDrawing().dimensions); widthIndex = dimensions.findIndex(d => Math.abs(d.value - 30) < 1e-9); assert.ok(widthIndex >= 0); widthId = dimensions[widthIndex].id;
  await widthRow().click(); await f.page.getByLabel('Tolerance', { exact: true }).selectOption('deviation'); await toleranceField('Upper', 0);
  const mm = await checkModel(); assert.deepEqual(mm.drawing.dimensions.find(d => d.id === widthId).tol, { kind: 'deviation', upper: 0, lower: 0 });
  await readSheet('01-mm-point'); assert.equal(await f.page.locator('[aria-label="Drawing issues"] [title="UNIT_PRECISION"]').count(), 0);
  f.phase = 'inch unprintable point'; const inch = await units('inch'); await unprintable('02-inch-unprintable'); await f.snapshot('02-inch-unprintable');
  f.phase = 'dual units and Undo/Redo'; await f.page.getByLabel('Dual units', { exact: true }).check(); await f.page.waitForFunction(() => window.__studioDoc.drawing.dual === true); const dual = await checkModel(); await unprintable('03-dual-unprintable');
  await f.undo(); await f.same(inch); await unprintable('04-undo-inch'); await f.redo(); await f.same(dual); await unprintable('05-redo-dual');
  f.phase = 'bounded precision remains explicit'; const detail = f.page.locator('details').filter({ has: f.page.getByLabel('Decimals in inch', { exact: true }) }).first(); if (!(await detail.evaluate(e => e.open))) await detail.locator('summary').first().click();
  const precision = f.page.getByLabel('Decimals in inch', { exact: true }); await precision.fill('2'); await precision.press('Tab'); await f.page.waitForFunction(() => window.__studioDoc.drawing.precision?.inch === 2); await unprintable('06-precision-two');
  f.phase = 'shifted representable point'; await toleranceField('Lower', -4.6); await toleranceField('Upper', -4.6); await representable('07-shifted-point'); await f.snapshot('07-shifted-point');
  const shifted = await checkModel(); assert.equal(shifted.drawing.units, 'inch'); assert.equal(shifted.drawing.dual, true); assert.equal(shifted.drawing.precision.inch, 2); assert.deepEqual(shifted.drawing.dimensions.find(d => d.id === widthId).tol, { kind: 'deviation', upper: -4.6, lower: -4.6 });
  assert.deepEqual(f.report.downloads, []); f.report.observations.push({ noModelMutation: true, nativeUnits: 'mm', authoredPointWitness: { nominalMM: 30, lowerMM: 0, upperMM: 0 }, representableControl: { nominalMM: 30, lowerMM: -4.6, upperMM: -4.6, endpointInch: 1 }, outboundExportAndSave: 'NOT_RUN' });
});
