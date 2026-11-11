import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an external evidence directory');

function box(width, depth, height, parameters = {}) {
  return {
    format: 'barocss-cad-model', schema: 3, units: 'mm', parameters,
    nodes: [
      { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [width, depth], id: 'n0' },
      { kind: 'extrude', sketch: 0, height, id: 'n1' },
    ],
    outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
  };
}
const master = {
  ...box(30, 12, { parameter: 'Height' }, { Height: 6 }),
  instances: [{ id: 'cap', name: 'Cap', doc: box(4, 3, 4), position: [10, 2, 8], rotation: [0, 0, 0] }],
  mates: [{ id: 'm1', kind: 'distance', distance: 2, a: { part: 'base', face: 'n1.top' }, b: { part: 'cap', face: 'n1.bottom' } }],
  variability: {
    version: 1,
    inputs: [
      { name: 'height', type: 'number', unit: 'mm', min: 1, max: 20, default: 6,
        bindings: [{ to: 'parameter', part: 'base', parameter: 'Height' }] },
      { name: 'gap', type: 'number', unit: 'mm', min: 0, max: 10, default: 2,
        bindings: [{ to: 'mate', mate: 'm1', field: 'distance' }] },
    ],
    variants: [{ name: 'Tall', values: { height: 9, gap: 5 } }],
  },
};

const oracleSource = String.raw`
from itertools import product
import json
import math
import re
import sys

d = json.load(sys.stdin)
text = d['text']
assert text.startswith('ISO-10303-21;') and text.strip().endswith('END-ISO-10303-21;')
assert "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'))" in text
assert 'SI_UNIT(.MILLI.,.METRE.)' in text and 'NEXT_ASSEMBLY_USAGE_OCCURRENCE' not in text
source, = re.findall(r'source revision ([0-9a-f]{16})', text)
records = dict(re.findall(r'^#(\d+)=(.+);$', text, re.M))
solids = [key for key, value in records.items() if value.startswith('MANIFOLD_SOLID_BREP(')]
assert len(solids) == 2, solids

def vertices(solid):
    stack = [solid]
    seen = set()
    positions = []
    while stack:
        key = stack.pop()
        if key in seen:
            continue
        seen.add(key)
        record = records[key]
        if record.startswith('VERTEX_POINT('):
            ref, = re.findall(r'#(\d+)', record)
            coords, = re.findall(r"^CARTESIAN_POINT\('',\(([^()]+)\)\)$", records[ref])
            positions.append(tuple(map(float, coords.split(','))))
        else:
            syntax = re.sub(r"'(?:[^']|'')*'", '', record)
            stack.extend(re.findall(r'#(\d+)', syntax))
    return sorted(positions)

parts = sorted(map(vertices, solids))
h, z = d['height'], d['height'] + d['gap']
expected = [list(product((0, 30), (0, 12), (0, h))), list(product((10, 14), (2, 5), (z, z + 4)))]
for actual, corners in zip(parts, expected):
    assert len(actual) == 8, actual
    assert all(math.dist(p, q) <= 1e-6 for p, q in zip(actual, corners)), (actual, corners)
losses = d['losses']
for entry in ('feature history', 'parameters and expressions', 'flattened at their placements', 'occurrence labels'):
    assert any(entry in loss for loss in losses), losses
print(json.dumps(dict(status='PASS', source=source, solids=len(solids), height=h, capBottom=z, losses=losses)))
`;

const f = await createFlow({
  name: 'step-shown-variant', envFrozen: 'D678_SOURCE_FROZEN', output, oracleSource,
  qualification: 'D678 desktop STEP preparation uses Master, Tall and restored Master',
  initialFiles: [
    'apps/cad-studio/test/step-shown-variant-browser.mjs',
    'packages/barocss-cad-model/src/assembly/variability.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts',
    'packages/barocss-cad-model/src/engine/wireDoc.ts', 'packages/barocss-cad/src/io/step.ts',
  ],
  limits: ['Two boxes, one named variant, one distance mate, real AP214 preparation in memory.'],
});

function observeStepAndPlacement() {
  const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
  if (!descriptor?.set) throw new Error('Worker onmessage setter required');
  const post = Worker.prototype.postMessage;
  const calls = new WeakMap();
  window.__d678 = { steps: [], placements: [] };
  Worker.prototype.postMessage = function (request, ...args) {
    if (request.type === 'step' || request.type === 'placed') {
      if (!calls.has(this)) calls.set(this, new Map());
      calls.get(this).set(request.id, request.type === 'step' ? { type: 'step' } : { type: 'placed', t: request.place.t });
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(Worker.prototype, 'onmessage', {
    configurable: true, get: descriptor.get,
    set(callback) {
      descriptor.set.call(this, callback && function (event) {
        const request = calls.get(this)?.get(event.data?.id);
        if (request?.type === 'step' && event.data.step) {
          window.__d678.steps.push({ id: event.data.id, ...event.data.step });
        } else if (request?.type === 'placed' && event.data.result) {
          window.__d678.placements.push({ id: event.data.id, t: request.t, ok: event.data.result.ok });
        }
        callback.call(this, event);
      });
    },
  });
}

const button = name => f.page.getByRole('button', { name, exact: true });
const variants = () => f.page.getByRole('complementary', { name: 'Variants panel', exact: true });
const stepPanel = () => f.page.getByLabel('STEP export', { exact: true });

async function prepare(label, height, gap, index, active) {
  f.phase = label;
  const volume = 30 * 12 * height;
  await f.page.waitForFunction(({ volume, bottom }) => {
    const bodies = window.__studioBodies?.();
    const placement = window.__d678.placements.at(-1);
    return bodies?.fresh && bodies.massReady && Math.abs(bodies.bodies[0]?.volume - volume) < 1e-8
      && placement?.ok && Math.abs(placement.t[2] - bottom) < 1e-6;
  }, { volume, bottom: height + gap });
  const accepted = await f.doc();
  assert.equal(accepted.variability.active, active);
  assert.deepEqual(accepted.parameters, master.parameters);
  assert.deepEqual(accepted.instances, master.instances);
  assert.deepEqual(accepted.mates, master.mates);
  const placement = await f.page.evaluate(() => window.__d678.placements.at(-1));
  [10, 2, height + gap].forEach((value, axis) => assert.ok(Math.abs(value - placement.t[axis]) < 1e-6));

  await button('Export STEP').click();
  const lossList = stepPanel().getByLabel('STEP loss report', { exact: true });
  await lossList.waitFor();
  const steps = await f.page.evaluate(() => window.__d678.steps);
  assert.equal(steps.length, index + 1);
  const reply = steps[index];
  assert.ok(typeof reply.text === 'string', reply.error);
  assert.deepEqual(await lossList.getByRole('listitem').allTextContents(), reply.omitted);
  assert.match(await stepPanel().innerText(), /STEP AP214 · B-rep geometry · mm/);
  assert.equal(await stepPanel().getByRole('button', { name: 'Export', exact: true }).isEnabled(), true);
  const result = await f.runOracle({ text: reply.text, losses: reply.omitted, height, gap }, label);
  f.report.observations.push({ label, placement, volume, result, replyId: reply.id, sha256: sha256(reply.text) });
  await f.snapshot(label);
  assert.deepEqual(await f.doc(), accepted);
  await stepPanel().getByRole('button', { name: 'Cancel', exact: true }).click();
  await stepPanel().waitFor({ state: 'detached' });
  return result;
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(observeStepAndPlacement);
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
        return url.origin === origin ? route.continue() : route.abort();
      });
      return context;
    } catch (error) {
      await context.close();
      throw error;
    }
  };
  await f.newPage();
  await f.page.setViewportSize({ width: 1440, height: 900 });
  const seed = Buffer.from(JSON.stringify(master));
  f.report.seedSHA256 = sha256(seed);
  f.phase = 'Open variant fixture';
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'step-variant.bcad', mimeType: 'application/json', buffer: seed });
  await f.same(master);
  await button('Variants').click();
  await variants().waitFor();
  const original = await prepare('01-master', 6, 2, 0, undefined);
  await variants().getByRole('button', { name: 'Show Tall', exact: true }).click();
  await variants().getByLabel('Variant shown', { exact: true }).getByText('Tall', { exact: true }).waitFor();
  const tall = await prepare('02-tall', 9, 5, 1, 'Tall');
  assert.notEqual(tall.source, original.source);
  await variants().getByRole('button', { name: 'Show the master', exact: true }).click();
  await variants().getByLabel('Variant shown', { exact: true }).waitFor({ state: 'detached' });
  const restored = await prepare('03-restored', 6, 2, 2, undefined);
  assert.deepEqual(restored, original);
  assert.deepEqual(await f.doc(), master);
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});
