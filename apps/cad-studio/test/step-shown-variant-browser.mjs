import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
assert.ok(mode === undefined || mode === '--round-trip' || mode === '--part-round-trip');
const roundTrip = mode !== undefined;
const standalone = mode === '--part-round-trip';
const profiles = {
  preparation: ['D678_SOURCE_FROZEN', 'D678 desktop STEP preparation uses Master, Tall and restored Master'],
  '--round-trip': ['D683_SOURCE_FROZEN', 'D683 Studio Export and fresh Open of the exact Tall STEP bytes'],
  '--part-round-trip': ['D691_SOURCE_FROZEN', 'D691 Studio Export and fresh Open of the D404 standalone box'],
};
const [envFrozen, qualification] = profiles[mode ?? 'preparation'];
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'), 'Use an external evidence directory');
const graphReader = 'apps/cad-studio/test/part21-prism-check.py';

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
const part = box(80, 50, 10);
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
assert len(solids) == len(d['boxes']), solids

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
expected = sorted(list(product(*zip(box['min'], box['max']))) for box in d['boxes'])
for actual, corners in zip(parts, expected):
    assert len(actual) == 8, actual
    assert all(math.dist(p, q) <= 1e-6 for p, q in zip(actual, corners)), (actual, corners)
losses = d['losses']
for entry in d['requiredLosses']:
    assert any(entry in loss for loss in losses), losses
print(json.dumps(dict(status='PASS', source=source, solids=len(solids), corners=sum(map(len, parts)), losses=losses)))
`;

const f = await createFlow({
  name: standalone ? 'step-standalone-part' : 'step-shown-variant', envFrozen, output, oracleSource, qualification,
  initialFiles: [
    'apps/cad-studio/test/model-rail-helper.mjs',
    'apps/cad-studio/test/step-shown-variant-browser.mjs',
    'packages/barocss-cad-model/src/assembly/variability.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts',
    'packages/barocss-cad-model/src/engine/wireDoc.ts', 'packages/barocss-cad/src/io/step.ts',
    ...(roundTrip ? [
      graphReader, 'apps/cad-studio/src/files/stepExportPreparation.ts', 'apps/cad-studio/src/files/StepExportPanel.tsx',
      'apps/cad-studio/src/files/importedFile.ts', 'packages/barocss-cad/src/io/step-import.ts',
    ] : []),
  ],
  limits: [
    standalone ? 'One standalone 80 × 50 × 10 mm sketch and extrude.' : 'Two boxes, one named variant and one distance mate.',
    roundTrip ? 'Real Export is intercepted at the local Blob boundary. Studio import is self-read evidence.' : 'Real AP214 preparation in memory.',
    'Independent readers check Part 21 graph, units and corners.',
  ],
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

function captureStepExport() {
  const create = URL.createObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  const blobs = new Map();
  window.__d683Exports = [];
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    if (blob.type === 'model/step') blobs.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = blobs.get(this.href);
    if (!blob || !this.download.endsWith('.step')) return click.call(this);
    blobs.delete(this.href);
    const name = this.download;
    window.__d683Exports.push(blob.arrayBuffer().then(bytes => ({ name, bytes: Array.from(new Uint8Array(bytes)) })));
  };
}

const button = name => f.page.getByRole('button', { name, exact: true });
const variants = () => f.page.getByRole('complementary', { name: 'Variants panel', exact: true });
const stepPanel = () => f.page.getByLabel('STEP export', { exact: true });

async function prepareStep(label, index) {
  await button('Export STEP').click();
  const lossList = stepPanel().getByLabel('STEP loss report', { exact: true });
  await lossList.waitFor();
  const steps = await f.page.evaluate(() => window.__d678.steps);
  assert.equal(steps.length, index + 1);
  const reply = steps[index];
  assert.ok(typeof reply.text === 'string', reply.error);
  const losses = await lossList.getByRole('listitem').allTextContents();
  assert.deepEqual(losses, reply.omitted);
  const profile = await stepPanel().innerText();
  assert.match(profile, /STEP AP214 · B-rep geometry · mm/);
  assert.equal(await stepPanel().getByRole('button', { name: 'Export', exact: true }).isEnabled(), true);
  await f.snapshot(label);
  return { reply, losses, profile };
}

async function capturePreparedStep(stem, reply) {
  assert.equal(await f.page.evaluate(() => window.__d683Exports.length), 0);
  await stepPanel().getByRole('button', { name: 'Export', exact: true }).click();
  await stepPanel().waitFor({ state: 'detached' });
  const [file, ...extra] = await f.page.evaluate(() => Promise.all(window.__d683Exports));
  assert.equal(file?.name, `${stem}.step`);
  assert.deepEqual(extra, []);
  const bytes = Buffer.from(file.bytes);
  assert.deepEqual(bytes, Buffer.from(reply.text, 'utf8'));
  return bytes;
}

function variantBounds(height, gap) {
  const bottom = height + gap;
  return [{ min: [0, 0, 0], max: [30, 12, height] }, { min: [10, 2, bottom], max: [14, 5, bottom + 4] }];
}

async function prepare(label, height, gap, index, active, exportFile = false) {
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

  const { reply, losses } = await prepareStep(label, index);
  let bytes;
  if (exportFile) bytes = await capturePreparedStep('step-variant', reply);
  else {
    await stepPanel().getByRole('button', { name: 'Cancel', exact: true }).click();
    await stepPanel().waitFor({ state: 'detached' });
  }
  const result = await f.runOracle({
    text: bytes?.toString('utf8') ?? reply.text, boxes: variantBounds(height, gap), losses,
    requiredLosses: ['feature history', 'parameters and expressions', 'flattened at their placements', 'occurrence labels'],
  }, label);
  f.report.observations.push({ label, placement, volume, result, replyId: reply.id, sha256: sha256(reply.text) });
  assert.deepEqual(await f.doc(), accepted);
  return { result, bytes };
}

async function reopenExactStep(bytes, stem, solidBounds, analytic) {
  f.phase = 'Read exported STEP graph and reopen the exact file';
  const filename = `${stem}.step`;
  const solidCount = solidBounds.length;
  const file = join(output, filename);
  const expectedFile = join(output, 'expected-step-geometry.json');
  const expected = {
    productCount: 1, solidCount, solidBounds,
    bounds: {
      min: [0, 1, 2].map(i => Math.min(...solidBounds.map(box => box.min[i]))),
      max: [0, 1, 2].map(i => Math.max(...solidBounds.map(box => box.max[i]))),
    },
  };
  await writeFile(file, bytes, { flag: 'wx' });
  await writeFile(expectedFile, JSON.stringify(expected), { flag: 'wx' });
  const runGraphReader = async (...options) => {
    const { stdout } = await promisify(execFile)('python3', ['-I', resolve(repo, graphReader), file, expectedFile, ...options]);
    return JSON.parse(stdout);
  };
  const graph = await runGraphReader();
  assert.equal(graph.status, 'PASS');
  assert.equal(graph.vertexCount, 8 * solidCount);
  assert.ok(Object.values(graph.absentEntities).every(count => count === 0), graph.absentEntities);
  const controls = await runGraphReader('--selftest');
  assert.deepEqual([controls.status, controls.positiveControls, controls.negativeControlsDetected], ['PASS', 2, 5]);
  assert.deepEqual(await readFile(file), bytes);

  await f.newPage();
  await f.page.setViewportSize({ width: 1440, height: 900 });
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(file);
  const total = analytic.reduce((sum, body) => sum + body.volume, 0).toLocaleString('en-US');
  const toast = await f.waitToast(/STEP opened|Could not open this file/, 60000);
  assert.match(toast, new RegExp(`STEP opened.*${solidCount} solid${solidCount === 1 ? '' : 's'}, in millimetres; ${total} mm³ in all.*no colours, names or assembly structure`));
  await f.ready();
  const imported = await f.doc();
  assert.equal(imported.units, 'mm');
  assert.deepEqual(imported.nodes.map(node => node.kind), ['import']);
  assert.equal(imported.nodes[0].solids, solidCount > 1 ? solidCount : undefined);
  assert.equal(imported.nodes[0].name, stem);
  assert.equal(imported.nodes[0].step, bytes.toString('utf8'));
  assert.deepEqual(imported.parameters, {});
  for (const key of ['instances', 'mates', 'variability', 'bodies']) assert.equal(imported[key], undefined);
  assert.equal(await f.page.locator('.doc-tab input').inputValue(), stem);
  const state = await f.bodies();
  assert.equal(state.bodies.length, solidCount);
  assert.deepEqual(state.colored, []);
  const actual = [...state.bodies].sort((a, b) => b.volume - a.volume);
  for (const [i, body] of actual.entries()) {
    assert.ok(Math.abs(body.volume - analytic[i].volume) < 1e-6, body.volume);
    analytic[i].centroid.forEach((value, axis) => assert.ok(Math.abs(body.centroid[axis] - value) < 1e-6));
  }
  await button('Iso').click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  f.report.observations.push({ label: 'fresh-open', name: filename, sha256: sha256(bytes), bytes: bytes.length, graph, controls, toast, imported: actual });
  assert.deepEqual(await readFile(file), bytes);
  await f.snapshot('02-step-reopened');
}

async function openFixture(doc, stem) {
  const seed = Buffer.from(JSON.stringify(doc));
  f.report.seedSHA256 = sha256(seed);
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: `${stem}.bcad`, mimeType: 'application/json', buffer: seed });
  await f.same(doc);
}

async function roundTripPart() {
  const stem = 'step-part';
  f.phase = 'Open D404 standalone box';
  await openFixture(part, stem);
  const analytic = [{ volume: 40000, centroid: [40, 25, 5] }];
  const bounds = [{ min: [0, 0, 0], max: [80, 50, 10] }];
  const sourceState = await f.bodies();
  assert.equal(sourceState.bodies.length, 1);
  assert.ok(Math.abs(sourceState.bodies[0].volume - analytic[0].volume) < 1e-6);

  f.phase = 'Prepare and export the standalone box';
  const label = '01-part-step-preview';
  const { reply, losses, profile } = await prepareStep(label, 0);
  assert.match(profile, /no native editing history, semantic PMI or named datum system transfer/);
  assert.doesNotMatch(losses.join(' '), /flattened at their placements/);
  const bytes = await capturePreparedStep(stem, reply);
  const result = await f.runOracle({ text: bytes.toString('utf8'), boxes: bounds, losses, requiredLosses: ['feature history'] }, label);
  f.report.observations.push({ label, profile, result, replyId: reply.id, sha256: sha256(bytes) });
  assert.deepEqual(await f.doc(), part);
  await reopenExactStep(bytes, stem, bounds, analytic);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    try {
      await context.addInitScript(observeStepAndPlacement);
      if (roundTrip) await context.addInitScript(captureStepExport);
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
  if (standalone) {
    await roundTripPart();
    assert.deepEqual(f.report.downloads, []);
    f.phase = 'complete';
    return;
  }
  f.phase = 'Open variant fixture';
  await openFixture(master, 'step-variant');
  await clickModelCommand(f.page, 'Inspect', 'Variants');
  await variants().waitFor();
  const original = roundTrip ? undefined : (await prepare('01-master', 6, 2, 0, undefined)).result;
  await variants().getByRole('button', { name: 'Show Tall', exact: true }).click();
  await variants().getByLabel('Variant shown', { exact: true }).getByText('Tall', { exact: true }).waitFor();
  const tall = await prepare(roundTrip ? '01-tall-step-preview' : '02-tall', 9, 5, roundTrip ? 0 : 1, 'Tall', roundTrip);
  if (original) assert.notEqual(tall.result.source, original.source);
  await variants().getByRole('button', { name: 'Show the master', exact: true }).click();
  await variants().getByLabel('Variant shown', { exact: true }).waitFor({ state: 'detached' });
  assert.deepEqual(await f.doc(), master);
  if (roundTrip) {
    assert.equal(tall.result.source, 'bb4cfd6d2ca9b48c');
    await reopenExactStep(tall.bytes, 'step-variant', variantBounds(9, 5), [
      { volume: 3240, centroid: [15, 6, 4.5] }, { volume: 48, centroid: [12, 3.5, 16] },
    ]);
  } else {
    const restored = await prepare('03-restored', 6, 2, 2, undefined);
    assert.deepEqual(restored.result, original);
    assert.deepEqual(await f.doc(), master);
  }
  assert.deepEqual(f.report.downloads, []);
  f.phase = 'complete';
});
