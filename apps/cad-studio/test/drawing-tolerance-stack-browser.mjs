import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const fixture = 'apps/cad-studio/test/fixtures/assembly-cut.bcad';
const pins = [
  fixture, 'apps/cad-studio/test/drawing-tolerance-stack-browser.mjs',
  'apps/cad-studio/src/ui/drawing/ToleranceStack.tsx',
  ...['toleranceStack', 'dimensions', 'decimal', 'standard', 'sheet', 'scope', 'types'].map(file =>
    `packages/barocss-cad-model/src/drawing/${file}.ts`),
];
const output = process.argv[2];
assert.ok(output && relative(resolve(import.meta.dirname, '../../..'), resolve(output)).startsWith('../'));
const f = await createFlow({
  name: 'drawing-tolerance-stack', output, envFrozen: 'D1256_SOURCE_FROZEN',
  qualification: 'Calculate an authored one-axis clearance from three actual Assembly Drawing dimensions.',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['One Top view of three independent rectangular contributors. Model mm, numeric deviations, no derived standard tolerances.'],
  oracleSource: `
import json
import sys
from decimal import Decimal as D
from itertools import product

data = json.load(sys.stdin)
lengths = [D('90'), D('60'), D('20')]
tolerances = [(D('-0.1'), D('0.2')), (D('-0.05'), D('0.05')), (D('-0.02'), D('0.08'))]
signs = [1, -1, data['shimSign']]
vertices = [sum(s * (n + t) for s, n, t in zip(signs, lengths, endpoint))
            for endpoint in product(*tolerances)]
want = [sum(s*n for s,n in zip(signs,lengths)), min(vertices), max(vertices)]
actual = [D(data[k]) for k in ('nominal','minimum','maximum')]
assert actual == want, (actual, want)
print(json.dumps({'status': 'PASS', 'unit': 'mm', 'endpointCombinations': len(vertices),
                  'nominal': str(want[0]), 'minimum': str(want[1]), 'maximum': str(want[2])}))
`,
});
const drawing = () => f.page.getByRole('complementary', { name: 'Drawing settings', exact: true });
const stack = () => drawing().locator('details[aria-label="Tolerance stack"]');
const result = () => stack().getByRole('status', { name: 'Tolerance stack result' });
const button = (name, within = f.page) => within.getByRole('button', { name, exact: true });
const mode = name => button(name, f.page.locator('.mode')).click();
const dimension = n => stack().getByRole('combobox', { name: 'Stack dimension ' + n, exact: true });
const dimRow = i => drawing().locator('.dw-dims .dw-dim').nth(i);
const tolerance = () => drawing().getByRole('combobox', { name: 'Tolerance', exact: true });

function linear(id, occurrence, y, width, z, tol) {
  const edge = `${occurrence}n1.side0|n1.top`;
  return { id, kind: 'linear', view: 'top', orient: 'horizontal', place: [width / 2, y - 4],
    a: { edge, at: 'end', near: [0, y, z] }, b: { edge, at: 'end', near: [width, y, z] }, tol };
}

async function openFixture(source, name) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.page.waitForFunction(title => window.__studioDoc?.drawing?.title === title, source.drawing.title);
  await f.ready();
}

async function openStack() {
  await mode('Drawing');
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.length === 3);
  await stack().locator('summary').click();
  await dimension(1).waitFor();
}

async function chooseTerms() {
  await dimension(1).selectOption('opening');
  await dimension(2).selectOption('insert');
  await button('Add term', stack()).click();
  await dimension(3).selectOption('d1');
}

async function verifyValues(label, shimSign, expectValues) {
  const keys = ['nominal', 'minimum', 'maximum'];
  await f.page.waitForFunction(values => {
    const status = document.querySelector('[aria-label="Tolerance stack result"]');
    return status && Array.from(status.querySelectorAll('[data-stack-value]'), e => e.textContent).join('|') === values;
  }, expectValues.map(v => v + ' mm').join('|'));
  const observed = Object.fromEntries(await Promise.all(keys.map(async key =>
    [key, (await result().locator(`[data-stack-value="${key}"]`).textContent()).replace(/ mm$/, '')])));
  const oracle = await f.runOracle({ ...observed, shimSign }, label);
  f.report.observations.push({ label, ...observed, unit: oracle.unit });
}

async function refused(pattern) {
  await result().getByText(pattern).waitFor();
  assert.equal(await result().locator('[data-stack-value]').count(), 0, 'an invalid chain must withhold all previous values');
}

await f.run(async () => {
  const newContext = f.browser.newContext.bind(f.browser);
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };

  const source = JSON.parse(await readFile(join(f.repo, fixture), 'utf8'));
  Object.assign(source.nodes[0], { min: [0, -22], max: [90, -2] });
  source.nodes[1].height = 4;
  const [insert, shim] = source.instances;
  insert.position = [0, 10, 0];
  shim.position = [0, 55, 0];
  shim.part = { id: 'shim', rev: 'A' };
  shim.rotation = [0, 0, 0];
  shim.doc.nodes[0].max = [20, 30];
  source.drawing = { title: 'Clearance stack', sheet: 'A3', scale: 1, scope: { kind: 'assembly' },
    projection: 'third', views: ['front', 'top'], hidden: false, dimensions: [
      linear('opening', '', -22, 90, 4, { kind: 'deviation', lower: -0.1, upper: 0.2 }),
      linear('insert', 'p1/', 10, 60, 5, { kind: 'symmetric', value: 0.05 }),
      linear('d1', 'p2/', 55, 20, 5, { kind: 'deviation', lower: -0.02, upper: 0.08 }),
    ] };

  f.phase = 'Open the real assembly drawing and calculate a three-term clearance';
  await f.newPage();
  await openFixture(source, 'stack-assembly.bcad');
  await openStack();
  const stock = await f.doc();
  const entries = await f.page.evaluate(() => window.__studioDrawing().dimensions);
  assert.deepEqual(entries.map(({ id, value }) => [id, value]), [['opening', 90], ['insert', 60], ['d1', 20]]);
  await chooseTerms();
  await verifyValues('01-clearance', -1, ['10', '9.77', '10.27']);
  await f.same(stock);
  await f.snapshot('01-clearance');

  f.phase = 'Check interval reversal, duplicate refusal and removal';
  await stack().getByRole('combobox', { name: 'Stack sign 3', exact: true }).selectOption('1');
  await verifyValues('02-positive-shim', 1, ['50', '49.83', '50.33']);
  await stack().getByRole('combobox', { name: 'Stack sign 3', exact: true }).selectOption('-1');
  await dimension(3).selectOption('insert');
  await refused(/only once|duplicate/i);
  await button('Remove stack term 3', stack()).click();
  await f.page.waitForFunction(() => document.querySelector('[data-stack-value="minimum"]')?.textContent === '29.85 mm');
  await button('Add term', stack()).click();
  await dimension(3).selectOption('d1');
  await verifyValues('03-restored-shim', -1, ['10', '9.77', '10.27']);
  await f.same(stock);

  f.phase = 'Refuse missing and fit tolerances, then restore the authored zone using Undo';
  await dimRow(2).locator('.dw-annotation-select').click();
  await tolerance().selectOption('none');
  await refused(/explicit|no tolerance|missing/i);
  await f.snapshot('04-missing-tolerance');
  await tolerance().selectOption('fit');
  await refused(/fit/i);
  await f.undo();
  await refused(/explicit|no tolerance|missing/i);
  await f.undo();
  await f.same(stock);
  await verifyValues('05-undo-tolerance', -1, ['10', '9.77', '10.27']);

  f.phase = 'Separate printed inches from authored model millimetres';
  await drawing().getByRole('combobox', { name: 'Drawing units', exact: true }).selectOption('inch');
  await f.page.waitForFunction(() => window.__studioDoc?.drawing?.units === 'inch');
  const printed = await dimension(1).locator('option[value="opening"]').textContent();
  assert.notEqual(printed, 'opening · 90 +0.2/-0.1 · top');
  assert.match(printed, /3\.54/);
  await verifyValues('06-inch-drawing', -1, ['10', '9.77', '10.27']);

  f.phase = 'Keep the analysis available after current projection options settle';
  await drawing().getByLabel('Tangent edges', { exact: true }).check();
  await f.page.waitForFunction(() => window.__studioDoc.drawing.tangent === true);
  await verifyValues('06-tangent-edges', -1, ['10', '9.77', '10.27']);

  f.phase = 'Withhold a removed term and recalculate after Undo';
  const inches = await f.doc();
  await dimRow(2).getByRole('button', { name: /^Remove dimension/ }).click();
  await refused(/Dimension d1 is missing/i);
  assert.match(await dimension(3).locator('option[value="d1"]').textContent(), /Unavailable/);

  f.phase = 'Refuse a different measurement when the drawing reuses the deleted dimension ID';
  await button('Linear dimension', f.page.getByRole('navigation', { name: 'Drawing tools', exact: true })).click();
  for (const [u, v] of [[0, 85], [20, 85], [10, 90]]) {
    const px = await f.page.evaluate(([x, y]) => window.__studioDrawingAt('top', x, y), [u, v]);
    assert.ok(px && Number.isFinite(px.x) && Number.isFinite(px.y));
    await f.page.mouse.move(px.x, px.y);
    await f.page.mouse.click(px.x, px.y);
  }
  await f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.some(d => d.id === 'd1' && d.value === 20));
  await dimRow(2).locator('.dw-annotation-select').click();
  await tolerance().selectOption('symmetric');
  await refused(/Dimension d1 changed. Select it again/i);
  assert.equal(await dimension(3).inputValue(), '');
  await f.snapshot('07-reused-id-refused');
  await dimension(3).selectOption('d1');
  await f.page.waitForFunction(() => document.querySelector('[data-stack-value="minimum"]')?.textContent === '9.75 mm');
  await f.undo();
  await f.undo();
  await f.undo();
  await f.same(inches);
  await refused(/Dimension d1 changed. Select it again/i);
  await dimension(3).selectOption('d1');
  await verifyValues('07-undo-remove', -1, ['10', '9.77', '10.27']);

  f.phase = 'Use the authored values after native Save and fresh File Open';
  const saved = await f.save('stack-inch');
  assert.deepEqual(saved.doc, inches);
  await f.freshOpen(saved.file, saved.doc, '08-open-saved');
  await openStack();
  assert.deepEqual(await Promise.all([dimension(1).inputValue(), dimension(2).inputValue()]), ['', '']);
  await chooseTerms();
  await verifyValues('09-reopened', -1, ['10', '9.77', '10.27']);
  f.phase = 'Refuse a saved assembly dimension whose occurrence no longer resolves';
  await mode('Model');
  const orphaned = structuredClone(inches);
  orphaned.drawing.title = 'Clearance stack with a removed shim';
  orphaned.instances = orphaned.instances.filter(instance => instance.id !== 'p2');
  await openFixture(orphaned, 'stack-lost-shim.bcad');
  await openStack();
  await f.page.waitForFunction(() => !!window.__studioDrawing?.()?.dimensions.find(d => d.id === 'd1')?.lost);
  await chooseTerms();
  await refused(/cannot resolve.*d1/i);
  await f.snapshot('10-lost-shim');
  assert.equal(f.report.downloads.length, 1);
});
