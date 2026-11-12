import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const pins = [
  'apps/cad-studio/test/linear-span-preview-bounds-browser.mjs',
  'apps/cad-studio/src/state/useCommandPreview.ts',
  'packages/barocss-cad-model/src/app/commands.ts',
  'packages/barocss-cad-model/src/engine/linearSpanPattern.ts',
  'packages/barocss-cad-model/src/engine/part.ts',
  'packages/barocss-cad/src/part/part-transform.ts',
];
const f = await createFlow({
  name: 'linear-span-preview-bounds', output: process.argv[2], envFrozen: 'D838_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Check fixed-span preview ownership, both creation count bounds and an unchanged native provider refusal.',
  limits: ['Actual desktop Studio and Worker. Two real Worker replies are delayed for ordering.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cylinderPart, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { captureSignatures } from '@barocss/cad-model/engine/references';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
const input = JSON.parse(process.argv[3]);
if (input.wrap) {
  const base = cylinderPart(10, 30), evaluated = evaluateDoc(base, 1);
  assert.ok(evaluated.ok);
  const doc = captureSignatures(withNode(base, {
    kind: 'cylindrical-wrap', parent: { node: 1, side: 'solid' }, faces: ['n1.side0#2'],
    rectangle: { u: [0.1, 0.4], v: [0.2, 0.7] }, height: 10,
  }), evaluated.bodies);
  const result = evaluateDoc(doc, 2);
  assert.ok(result.ok);
  console.log(JSON.stringify(doc));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const node = doc.nodes[2], { span, ...rest } = node;
  const [output, ...extra] = evaluateCadPart(toPartDocument(doc)).outputs;
  const control = { ...doc, nodes: [...doc.nodes.slice(0, 2), { ...rest, kind: 'linear-pattern', spacing: input.pitch }] };
  assert.equal(extra.length, 0);
  assert.deepEqual(output.brep, evaluateCadPart(toPartDocument(control)).outputs[0].brep);
  console.log(JSON.stringify({
    id: output.id, valid: checkOutput(output).valid, count: output.bodyCount, mass: massPropertiesOf(output),
    corners: output.brep.vertices.map(vertex => vertex.point),
    closed: output.brep.shells.every(shell => shell.closed),
  }));
}
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => document.querySelector(`button[aria-label="${name}"]`).disabled),
  }),
});

const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [30, 10], max: [40, 16] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
};
const button = (panel, name) => panel.getByRole('button', { name, exact: true });
const hud = () => f.page.getByRole('dialog', { name: 'Linear pattern', exact: true });
const field = name => hud().getByLabel(name, { exact: true });
const status = value => f.page.waitForFunction(value => document.querySelector('.hud .status')?.textContent.trim() === value, value);
const select = key => f.page.locator('.outliner .ol-row > button.ol').filter({ hasText: key }).click();
const open = async (name, doc) => {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
};
const near = (a, b) => Math.abs(a - b) < 1e-8;

function holdPreview() {
  const worker = Worker.prototype, send = worker.postMessage;
  const onmessage = Object.getOwnPropertyDescriptor(worker, 'onmessage');
  let armed = false, target, held, deliver;
  worker.postMessage = function (request, ...args) {
    if (armed && request.type === 'preview') {
      armed = false;
      target = { worker: this, id: request.id, revision: request.revision };
    }
    return Reflect.apply(send, this, [request, ...args]);
  };
  Object.defineProperty(worker, 'onmessage', {
    configurable: true, get: onmessage.get,
    set(callback) {
      onmessage.set.call(this, callback && function (event) {
        if (target?.worker === this && event.data?.id === target.id && event.data.result) {
          held = { id: target.id, revision: target.revision, ok: event.data.result.ok };
          deliver = () => callback.call(this, event);
          target = undefined;
          return;
        }
        callback.call(this, event);
      });
    },
  });
  window.__d838Preview = {
    arm() { held = undefined; armed = true; },
    read: () => held,
    release() { deliver(); deliver = undefined; },
  };
}

async function begin(axis, count, span) {
  await clickModelCommand(f.page, 'Pattern', 'Linear pattern');
  await field('Direction').selectOption(axis);
  await field('Count').fill(String(count));
  await field('Distance mode').selectOption('span');
  await field('Total span').fill(String(span));
  await status('preview');
}

async function holdSpan(span) {
  await f.page.evaluate(() => window.__d838Preview.arm());
  await field('Total span').fill(String(span));
  await f.page.waitForFunction(() => window.__d838Preview.read());
  const held = await f.page.evaluate(() => window.__d838Preview.read());
  assert.equal(held.ok, true);
  await status('evaluating…');
  await field('Total span').press('Enter');
  return held;
}

async function verifyBound(label, axis, count, span, pitch, base) {
  await status('preview');
  await button(hud(), 'Apply').click();
  await hud().waitFor({ state: 'hidden' });
  await f.changed(base);
  const accepted = await f.doc();
  assert.deepEqual(accepted.nodes.slice(0, 2), base.nodes);
  assert.deepEqual(accepted.nodes[2], { kind: 'linear-span-pattern', parent: { node: 1, side: 'solid' }, axis, span, count, id: 'n2' });
  assert.deepEqual(accepted.outputs, { b2: { node: 2, side: 'solid' } });
  const native = await f.inspect(label, accepted, { pitch });
  const k = 'xyz'.indexOf(axis), volume = 480 * count, centroid = [35, 13, 4];
  centroid[k] += span / 2;
  assert.ok(native.valid && native.closed);
  assert.equal(native.id, 'n2');
  assert.equal(native.count, count);
  assert.equal(native.corners.length, count * 8);
  for (let i = 0; i < count; i++) {
    for (const x of [30, 40]) for (const y of [10, 16]) for (const z of [0, 8]) {
      const expected = [x, y, z];
      expected[k] += pitch * i;
      assert.ok(native.corners.some(point => point.every((value, j) => near(value, expected[j]))));
    }
  }
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b2']);
  for (const result of [native.mass, bodies[0]]) {
    assert.ok(near(result.volume, volume));
    assert.ok(result.centroid.every((value, j) => near(value, centroid[j])));
  }
  f.report.observations.push({ label, axis, count, span, pitch, volume, centroid, corners: count * 8 });
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  await f.snapshot(label);
  return accepted;
}

function sameAccepted(a, b) {
  for (const key of ['doc', 'history', 'historyControls', 'dirty', 'selection']) assert.deepEqual(a[key], b[key], key);
  for (const key of ['fresh', 'massReady', 'bodies']) assert.deepEqual(a.bodies[key], b.bodies[key], key);
  assert.deepEqual(a.bodies.colored, []);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.addInitScript(holdPreview);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  await open('D838-seed.bcad', seed);
  await select('Extrude');
  f.phase = 'supersede a queued Enter and held valid preview by changing mode and input';
  await begin('z', 2, 20);
  const beforeMode = await f.snapshot('accepted-before-held-mode');
  const oldMode = await holdSpan(22);
  await field('Distance mode').selectOption('spacing');
  await field('Spacing').fill('0');
  await f.page.evaluate(() => window.__d838Preview.release());
  await status('refused');
  assert.match(await hud().locator('.hud-error').textContent(), /spacing must not be zero/i);
  assert.ok(await button(hud(), 'Apply').isDisabled());
  sameAccepted(await f.snapshot('old-success-retired-after-mode-change'), beforeMode);
  f.report.observations.push({ label: 'mode-switch-held-success', ...oldMode, currentRefused: true });

  f.phase = 'retire a queued preview when Open replaces a document with the same feature IDs';
  await field('Spacing').fill('20');
  await field('Distance mode').selectOption('span');
  await status('preview');
  const oldDocument = await holdSpan(24);
  const replacement = { ...seed, nodes: [seed.nodes[0], { ...seed.nodes[1], height: 9 }] };
  await open('D838-replacement.bcad', replacement);
  await hud().waitFor({ state: 'hidden' });
  const replacementBefore = await f.snapshot('replacement-before-old-reply');
  await f.page.evaluate(() => window.__d838Preview.release());
  sameAccepted(await f.snapshot('replacement-after-old-reply'), replacementBefore);
  await f.undo();
  await f.same(seed);
  f.report.observations.push({ label: 'document-held-success', ...oldDocument, currentHeight: 9 });

  f.phase = 'apply Z Count 2 and Y Count 24 through the current command';
  await select('Extrude');
  await begin('z', 2, 20);
  await verifyBound('z-min-count', 'z', 2, 20, 20, seed);
  await f.undo();
  await f.same(seed);
  await select('Extrude');
  await begin('y', 24, 184);
  const upper = await verifyBound('y-max-count', 'y', 24, 184, 8, seed);

  f.phase = 'keep the accepted cylindrical wrap when the native provider refuses to consume it';
  const wrap = await f.inspect('wrap-fixture', seed, { wrap: true });
  await open('D838-wrap.bcad', wrap);
  await f.page.locator('.outliner .ol-row > button.ol').click();
  await clickModelCommand(f.page, 'Pattern', 'Linear pattern');
  await field('Count').fill('2');
  await field('Distance mode').selectOption('span');
  await field('Total span').fill('50');
  await status('refused');
  assert.match(await hud().locator('.hud-error').textContent(), /cylindrical wrap reference cannot be consumed/i);
  assert.ok(await button(hud(), 'Apply').isDisabled());
  await field('Total span').press('Enter');
  await f.same(wrap);
  await f.snapshot('native-wrap-refusal');
  await button(hud(), 'Cancel').click();
  await f.undo();
  assert.deepEqual(await f.doc(), upper);
  await f.redo();
  await f.same(wrap);
  assert.deepEqual(f.report.downloads, []);
});
