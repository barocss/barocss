import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const baselineMode = process.argv.includes('--baseline');
const f = await createFlow({
  name: 'counterbore-pattern-drawing', output, envFrozen: 'D1244_SOURCE_FROZEN',
  qualification: 'Compare actual Drawing and SVG quantities against a circular counterbore fixture.',
  initialFiles: [
    'apps/cad-studio/test/counterbore-pattern-drawing-browser.mjs',
    'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
    'apps/cad-studio/src/ui/useDrawingSheet.ts',
    'packages/barocss-cad-model/src/drawing/callout.ts',
    'packages/barocss-cad-model/src/drawing/auto.ts',
    'packages/barocss-cad-model/src/drawing/sheet.ts',
    ...(!baselineMode ? ['packages/barocss-cad-model/src/drawing/holeCircles.ts'] : []),
    'packages/barocss-cad-model/src/drawing/issues.ts',
    'packages/barocss-cad-model/src/drawing/layout.ts',
    'packages/barocss-cad-model/src/drawing/tolerance.ts',
    'packages/barocss-cad-model/src/chat/drawing.ts',
    'packages/barocss-cad-model/src/io/svg.ts',
    'packages/barocss-cad-model/src/io/pdf.ts',
  ],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { checkBrep } from '@barocss/cad';
import { brepsFor } from '@barocss/cad-model/engine/evaluate';
import { projectViews } from '@barocss/cad-model/drawing/project';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const native = brepsFor(doc);
if ('error' in native) throw Error(native.error);
const projection = projectViews(native.breps, native.prefixes);
if (!projection.ok) throw Error(projection.error);
const rings = projection.views.top.edges.filter(e => e.circle).map(e => ({ edge:e.name, ...e.circle }));
console.log(JSON.stringify({ rings, strict: native.breps.map(b => checkBrep(b, { strict:true })) }));
`,
  oracleSource: String.raw`
import json, re, sys, xml.etree.ElementTree as ET
svg = ET.fromstring(json.load(sys.stdin))
ns = '{http://www.w3.org/2000/svg}'
callout = re.compile(r'(?:THRU|DEEP|EQ SP)')
texts = [' '.join(t.text.split()) for t in svg.iter(ns + 'text') if t.text and callout.search(t.text)]
print(json.dumps({'status': 'PASS', 'texts': texts}))
`,
  limits: ['One base body, A4 SVG, numeric axial through and blind circular Hole patterns.'],
});

const stock = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 40] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 12 },
    { id: 'n2', kind: 'hole', parent: { node: 1, side: 'solid' }, center: [28, 20], radius: 2,
      face: 'n1.top', pattern: { count: 4, about: [20, 20] } },
    { id: 'n3', kind: 'hole', parent: { node: 2, side: 'solid' }, center: [28, 20], radius: 3, depth: 3,
      face: 'n1.top', pattern: { count: 4, about: [20, 20] } },
  ],
  outputs: { b3: { node: 3, side: 'solid' } }, nextId: 4,
};
const button = name => f.page.getByRole('button', { name, exact: true });
const normalize = text => text.trim().replace(/\s+/g, ' ');
const isCallout = text => /THRU|DEEP|EQ SP/.test(text);

async function openDocument(doc, name) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
}

async function readPdf(label, expected) {
  const [download] = await Promise.all([f.page.waitForEvent('download'), button('Export PDF').click()]);
  const file = join(output, label + '.pdf');
  await download.saveAs(file);
  const bytes = await readFile(file);
  assert.equal(bytes.subarray(0, 8).toString(), '%PDF-1.4');
  const text = Array.from(bytes.toString('latin1').matchAll(/\(((?:\\.|[^()\\])*)\) Tj/g), match =>
    match[1].replace(/\\([0-7]{3}|[()\\])/g, (_, escape) => escape.length === 3 ? String.fromCharCode(parseInt(escape, 8)) : escape));
  assert.match(bytes.toString('latin1'), /\/Type \/Pages[^>]*\/Count 1\b/);
  assert.deepEqual(text.filter(isCallout).map(normalize).sort(), [...expected].sort());
  return sha256(bytes);
}

async function capture(label, expectedVolume) {
  f.phase = label;
  const sheet = f.page.locator('svg[aria-label="Drawing sheet"]');
  await sheet.waitFor();
  await f.page.waitForFunction(() => window.__studioDrawing?.() && !document.querySelector('.dw-busy'));
  const texts = (await sheet.locator('text').allTextContents()).map(normalize).filter(isCallout);
  const [download] = await Promise.all([f.page.waitForEvent('download'), button('Export SVG').click()]);
  const file = join(output, label + '.svg');
  await download.saveAs(file);
  const bytes = await readFile(file);
  const printed = await f.runOracle(bytes.toString('utf8'), label);
  assert.deepEqual([...printed.texts].sort(), [...texts].sort());
  const { bodies } = await f.snapshot(label, () => ({ drawing: window.__studioDrawing() }));
  assert.equal(bodies.bodies.length, 1);
  const volume = bodies.bodies[0].volume;
  assert.ok(Math.abs(volume - expectedVolume) < 1e-7, volume);
  const native = await f.inspect(label, await f.doc());
  assert.equal(native.strict.length, 1);
  assert.ok(native.strict[0].valid, JSON.stringify(native.strict[0]));
  const pdfHash = baselineMode ? undefined : await readPdf(label, texts);
  f.report.observations.push({ label, texts, volume, svgHash: sha256(bytes), pdfHash });
  return { texts, bytes, native, pdfHash };
}

await f.run(async () => {
  await f.newPage();
  await openDocument(stock, 'aligned-pattern');
  await button('Drawing').click();
  await button('Auto-dimension').click();
  await f.changed(stock);
  const drawing = await f.doc();
  const aligned = 19200 - 252 * Math.PI;
  const shifted = 19200 - 288 * Math.PI;
  const baseline = await capture('aligned-four', aligned);
  assert.ok(baseline.texts.includes('4× Ø4 THRU CBORE Ø6 × 3 DEEP'));

  await button('Model').click();
  await f.openFeatureEditor(3, 'counterbore');
  await f.editor().getByLabel('Circle centre X', { exact: true }).fill('17');
  await f.editor().getByLabel('Circle centre Y', { exact: true }).fill('17');
  const moved = (await f.applyEditor(drawing, 'shifted-centre')).doc;
  assert.deepEqual(moved.nodes[2], stock.nodes[2]);
  assert.deepEqual(moved.nodes[3].pattern, { count: 4, about: [17, 17] });
  assert.deepEqual(moved.drawing.dimensions.map(d => d.id), drawing.drawing.dimensions.map(d => d.id));
  await button('Drawing').click();
  const retained = await capture('shifted-retained-drawing', shifted);
  const classify = (rings, size) => {
    const points = rings.filter(ring => Math.abs(ring.radius - size) < 1e-8 && Math.abs(ring.center[2] - 12) < 1e-8)
      .map(ring => ring.center.slice(0, 2).map(x => Math.round(x)).join(','));
    return [...new Set(points)].sort();
  };
  assert.deepEqual(classify(retained.native.rings, 2), ['12,20', '20,12', '20,28']);
  assert.deepEqual(classify(retained.native.rings, 3), ['14,28', '20,6', '28,20', '6,14']);
  const shoulders = retained.native.rings.filter(ring => /n2_p0\.side\d.*\|n3_p0\.bottom/.test(ring.edge));
  assert.ok(shoulders.length > 0 && shoulders.every(ring =>
    Math.abs(ring.radius - 2) < 1e-8 && ring.center.every((value, i) => Math.abs(value - [28, 20, 9][i]) < 1e-8)));
  const kinds = result => result.texts.filter(text => /THRU|DEEP/.test(text)).sort();
  const expected = ['3× Ø4 THRU', '3× Ø6 × 3 DEEP', 'Ø4 THRU CBORE Ø6 × 3 DEEP'];
  if (!baselineMode) {
    assert.deepEqual(kinds(retained), []);
    const drawingState = await f.page.evaluate(() => window.__studioDrawing());
    assert.ok(drawingState.dimensions.some(d => d.lost?.includes('The hole pattern quantity changed or cannot be verified')));
    await button('Auto-dimension').click();
    await f.changed(moved);
    const refreshed = await capture('shifted-refreshed-drawing', shifted);
    assert.deepEqual(kinds(refreshed), expected);
    await button('Model').click();
    await f.undo();
    await f.same(moved);
  }

  await button('Model').click();
  await f.undo();
  await f.same(drawing);
  await button('Drawing').click();
  const undone = await capture('aligned-undo', aligned);
  assert.deepEqual(undone.bytes, baseline.bytes);
  assert.equal(undone.pdfHash, baseline.pdfHash);

  if (!baselineMode) {
    await button('Model').click();
    await f.openFeatureEditor(3, 'aligned counterbore');
    await f.editor().getByLabel('Copies', { exact: true }).fill('2');
    const twoRecesses = (await f.applyEditor(drawing, 'recess-copies-two')).doc;
    assert.equal(twoRecesses.nodes[2].pattern.count, 4);
    assert.equal(twoRecesses.nodes[3].pattern.count, 2);
    await button('Drawing').click();
    const twoVolume = 19200 - 222 * Math.PI;
    assert.deepEqual(kinds(await capture('two-recesses-retained-drawing', twoVolume)), []);
    await button('Auto-dimension').click();
    await f.changed(twoRecesses);
    assert.deepEqual(kinds(await capture('two-recesses-refreshed-drawing', twoVolume)),
      ['2× Ø4 THRU', '2× Ø4 THRU CBORE Ø6 × 3 DEEP']);
  }

  await f.newPage();
  const { drawing: discarded, ...withoutDrawing } = moved;
  await openDocument(withoutDrawing, 'shifted-pattern');
  await button('Drawing').click();
  await button('Auto-dimension').click();
  await f.changed(withoutDrawing);
  const regenerated = await capture('shifted-new-auto-dimension', shifted);

  if (baselineMode) {
    assert.ok(retained.texts.includes('4× Ø4 THRU CBORE Ø6 × 3 DEEP'), retained.texts);
    assert.ok(regenerated.texts.includes('7× Ø4 THRU CBORE Ø6 × 3 DEEP'), regenerated.texts);
    throw new Error('Stored and new drawing callouts report false counterbore quantities.');
  }
  assert.deepEqual(kinds(regenerated), expected);
  await button('Model').click();
  const { file, doc } = await f.save('qualified-counterbore-pattern');
  await f.freshOpen(file, doc, 'qualified-counterbore-reopened');
  await button('Drawing').click();
  assert.deepEqual(kinds(await capture('shifted-reopened-drawing', shifted)), expected);
});
