// D582 / #2422. Run under the heavy gate from apps/cad-studio.
// D582_SOURCE_FROZEN=1 node test/keepout-chord-interval-browser.mjs EXTERNAL_OUTPUT --expect=repro|fixed
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=fixed'].includes(mode));
const repro = mode === '--expect=repro';

const requirement = (id, source, predicate) => ({
  id, source, hard: true, basis: 'stated',
  check: { ...predicate, query: { fn: 'keepout', keepout: 'K1' }, unit: 'mm' },
});
// The 10 mm cube and the cylinder from reference-bodies.test.ts, alone in this file.
const fixture = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2,
  references: { version: 1, references: [], datums: [], keepouts: [{
    id: 'K1', name: 'Cylinder post', clearance: 5,
    frame: { origin: [20, 5, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] },
    shape: { kind: 'cylinder', radius: 5, height: 10 },
  }] },
  requirements: [
    requirement('EQ-CENTER', 'Exact nominal clearance', { op: '==', value: 5, tol: 0.002 }),
    requirement('EQ-OFFSET', 'Exact offset clearance', { op: '==', value: 5.012, tol: 0.002 }),
    requirement('RANGE-CENTER', 'Narrow nominal range', { op: 'between', min: 4.998, max: 5.002 }),
    requirement('RANGE-OFFSET', 'Narrow offset range', { op: 'between', min: 5.010, max: 5.014 }),
    requirement('RANGE-WIDE', 'Range covers the error interval', { op: 'between', min: 4.96, max: 5.04 }),
    requirement('RANGE-OUTSIDE', 'Range is separate from the error interval', { op: 'between', min: 5.04, max: 5.05 }),
    requirement('MIN-NEAR', 'At least the nominal clearance', { op: '>=', value: 5 }),
    requirement('MIN-CLEAR', 'Below the whole error interval', { op: '>=', value: 4.96 }),
    requirement('MIN-FAIL', 'Above the whole error interval', { op: '>=', value: 5.04 }),
  ],
  history: [{ id: 'h1', at: '2026-11-10T00:00:00Z', kind: 'prompt', by: { agent: 'chat', model: 'test' },
    prompt: 'Place the fixture beside the cube.' }],
};

const oracleSource = String.raw`
import json, math, re, sys
from decimal import Decimal as D
from itertools import product

data = json.load(sys.stdin, parse_float=D)
doc = data['doc']
sketch, extrude = doc['nodes']
post, = doc['references']['keepouts']
x, y, z = post['frame']['origin']
radius = post['shape']['radius']
assert post['frame']['normal'] == [0, 0, 1]
assert sketch['min'][1] <= y <= sketch['max'][1]
assert max(0, z) < min(extrude['height'], z + post['shape']['height'])
exact = x - radius - sketch['max'][0]
assert exact == post['clearance'] == 5
body, = data['bodies']
assert body['key'] == 'b1'
assert math.isclose(body['volume'], 1000, rel_tol=0, abs_tol=1e-9)
assert all(math.isclose(v, 5, rel_tol=0, abs_tol=1e-9) for v in body['centroid'])

# Reference bodies title reports clearance to 6 significant figures and chord to 3.
match = re.fullmatch(r"([\d.]+) mm from it, within the meshes' chord tolerance ([\d.]+) mm of the 5 mm it asks for: not decided by the meshes", data['keepoutTitle'])
assert match, data['keepoutTitle']
mesh, chord = map(D, match.groups())
def rounding_band(value, significant_digits):
    half_unit = D('0.5').scaleb(value.adjusted() - significant_digits + 1)
    return value - half_unit, value + half_unit

mesh_band = rounding_band(mesh, 6)
chord_band = rounding_band(chord, 3)
sag = radius * D(str(1 - math.cos(math.pi / 32)))
assert chord_band[0] > 0 and abs(chord - sag) < D('0.0001'), (chord, sag)
assert mesh_band[0] >= exact - chord_band[0]
assert mesh_band[1] <= exact + chord_band[0]

def allowed(predicate):
    op = predicate['op']
    eps = D('1e-9')
    if op == 'between':
        return predicate['min'] - eps, predicate['max'] + eps
    value = predicate['value']
    slack = predicate.get('tol', 0) + eps * max(1, abs(value))
    if op == '==':
        return value - slack, value + slack
    assert op == '>='
    return value - slack, D('Infinity')

def verdicts(predicate, center, bound):
    low, high = center - bound, center + bound
    minimum, maximum = allowed(predicate)
    if minimum <= low and high <= maximum:
        interval = 'pass'
    elif high < minimum or maximum < low:
        interval = 'fail'
    else:
        interval = 'unknown'
    inside = lambda n: minimum <= n <= maximum
    legacy = 'unknown' if inside(low) != inside(high) else 'pass' if inside(center) else 'fail'
    return interval, legacy

# The endpoint comparisons are linear. Check that their signs stay the same
# at every corner of the display rounding bands. The legacy rule uses the center
# only when the endpoints agree.
def stable_verdicts(predicate):
    minimum, maximum = allowed(predicate)
    corners = list(product(mesh_band, chord_band))

    def consistently_inside(direction):
        signs = []
        for limit in [minimum, maximum]:
            differences = [center + direction * bound - limit for center, bound in corners]
            assert max(differences) < 0 or min(differences) > 0, (predicate, differences)
            signs.append(min(differences) > 0)
        return signs == [True, False]

    if consistently_inside(-1) == consistently_inside(1):
        consistently_inside(0)
    results = {verdicts(predicate, center, bound) for center, bound in corners}
    assert len(results) == 1, (predicate, results)
    return results.pop()

expected, legacy = {}, {}
for req in doc['requirements']:
    expected[req['id']], legacy[req['id']] = stable_verdicts(req['check'])
print(json.dumps({'status':'PASS', 'analyticClearanceMM':exact,
                  'renderedMeshClearanceMM':str(mesh), 'renderedChordMM':str(chord),
                  'meshRoundingBandMM':list(map(str, mesh_band)),
                  'chordRoundingBandMM':list(map(str, chord_band)), 'cylinderSagMM':str(sag),
                  'expected':expected, 'legacy':legacy}))
`;

const pins = [
  'apps/cad-studio/test/keepout-chord-interval-browser.mjs',
  'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useModelChecks.ts',
  'apps/cad-studio/src/ui/RequirementsBrowser.tsx',
  'apps/cad-studio/src/ui/ReferencesPanel.tsx',
  'apps/cad-studio/src/engine/client.ts',
  'apps/cad-studio/src/engine/engine.worker.ts',
  'packages/barocss-cad-model/src/chat/spec.ts',
  'packages/barocss-cad-model/src/chat/references.ts',
  'packages/barocss-cad-model/src/engine/schema/spec.ts',
  'packages/barocss-cad-model/src/engine/schema/references.ts',
  'packages/barocss-cad-model/src/engine/doc.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad-model/test/reference-bodies.test.ts',
];

const f = await createFlow({
  name: 'keepout-chord-interval', envFrozen: 'D582_SOURCE_FROZEN', output,
  qualification: 'D582 #2422 desktop', initialFiles: pins, requiredFrozen: pins, oracleSource,
  limits: [
    'Programmatically authored fixture through public Open. Single native cube and cylinder keep-out, no UI authoring.',
    'Reference bodies supplies rounded measurement evidence. The independent oracle covers the reported rounding bands.',
    'Browser project Save to OPFS, followed by public Open of the saved bytes in a fresh context.',
  ],
  snapshotExtra: () => {
    const browser = document.querySelector('[aria-label="Browser"]');
    const keepout = browser?.querySelector('[aria-label="Keep-out K1"] .req-row');
    return {
      dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
      summary: browser?.querySelector('.req-head:has([aria-label="Failing only"]) .muted')?.textContent ?? null,
      requirements: Object.fromEntries([...(browser?.querySelectorAll('.req[aria-label^="Requirement "]') ?? [])].map(row => [
        row.getAttribute('aria-label').slice('Requirement '.length),
        { status: row.classList[1], title: row.querySelector('.req-row').title, text: row.textContent },
      ])),
      keepout: { text: keepout?.textContent ?? null, title: keepout?.title ?? null,
        summary: browser?.querySelector('[aria-label="Reference bodies summary"]')?.textContent ?? null },
    };
  },
});
const button = name => f.page.getByRole('button', { name, exact: true });
const panel = () => f.page.getByRole('complementary', { name: 'Browser', exact: true });

async function boundary() {
  return f.page.evaluate(() => ({
    doc: JSON.parse(JSON.stringify(window.__studioDoc)),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    toolbar: ['Undo', 'Redo'].map(name => {
      const control = document.querySelector(`button[aria-label="${name}"]`);
      if (!control) throw new Error(`Missing ${name} toolbar control`);
      return { disabled: control.disabled, tip: control.getAttribute('data-tip') };
    }),
    features: [...document.querySelectorAll('.history .hs')].map(row => ({
      label: row.getAttribute('aria-label'), className: row.className,
    })),
  }));
}

async function open(name, bytes) {
  f.phase = `public Open ${name}`;
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/octet-stream', buffer: bytes });
  // The document is compared semantically so a parser may preserve or reorder keys.
  await f.page.waitForFunction(() => window.__studioDoc?.references?.keepouts?.[0]?.id === 'K1');
  await f.ready();
  assert.deepEqual(await f.doc(), fixture);
}

async function check(label) {
  f.phase = `${label} settled Requirements and Reference bodies`;
  const before = await boundary();
  assert.equal(before.dirty, false);
  assert.ok(before.features.length > 0);
  await panel().getByText('Requirements', { exact: false }).first().waitFor();
  await f.page.waitForFunction(() => {
    const browser = document.querySelector('[aria-label="Browser"]');
    const summary = browser?.querySelector('.req-head:has([aria-label="Failing only"]) .muted')?.textContent;
    const title = browser?.querySelector('[aria-label="Keep-out K1"] .req-row')?.title;
    return /^\d+ ✓ · \d+ ✗ · \d+ \?$/.test(summary ?? '') && !!title;
  }, null, { timeout: 60000 });
  const state = await f.snapshot(label);
  assert.match(state.keepout.text, /cylinder · clearance 5 · undecided, 5 mm \(±0\.0241\)/);
  assert.match(state.keepout.summary, /0 violated, 1 undecided/);
  const observed = Object.fromEntries(Object.entries(state.requirements).map(([id, row]) => [id, row.status]));
  const oracle = await f.runOracle({
    doc: state.doc, bodies: state.bodies.bodies, keepoutTitle: state.keepout.title, observed,
  }, label);
  const firstRepro = [
    ['EQ-CENTER', 'pass'], ['EQ-OFFSET', 'fail'], ['RANGE-CENTER', 'pass'], ['RANGE-OFFSET', 'fail'],
  ].map(([id, legacy]) => ({ id, expected: 'unknown', legacy, observed: observed[id] }));
  f.report.observations.push({ label, firstRepro, observed, summary: state.summary, referenceReport: state.keepout });
  await f.persist();

  for (const { id, expected, legacy } of firstRepro) {
    assert.equal(oracle.expected[id], expected);
    assert.equal(oracle.legacy[id], legacy);
  }
  assert.deepEqual(observed, repro ? oracle.legacy : oracle.expected);
  const count = status => Object.values(observed).filter(s => s === status).length;
  assert.equal(state.summary, `${count('pass')} ✓ · ${count('fail')} ✗ · ${count('unknown')} ?`);
  for (const [id, row] of Object.entries(state.requirements)) {
    assert.match(row.title, /chord tolerance 0\.0241 mm/);
    if (row.status === 'unknown') {
      assert.match(row.title, /undecided: 5 .*chord tolerance/);
      assert.ok(row.text.includes(row.title), `${id} shows the reason`);
    }
  }
  assert.deepEqual(await boundary(), before);
  assert.deepEqual(before.doc, fixture);

  const filter = panel().getByRole('button', { name: 'Failing only', exact: true });
  await filter.click();
  const idsShown = () => panel().getByRole('listitem', { name: /^Requirement / }).evaluateAll(rows =>
    rows.map(row => row.getAttribute('aria-label').slice('Requirement '.length)));
  assert.deepEqual(await idsShown(), Object.keys(observed).filter(id => observed[id] !== 'pass'));
  await filter.click();
  assert.deepEqual(await idsShown(), Object.keys(observed));
  assert.deepEqual(await boundary(), before);
  return { observed, summary: state.summary, keepout: state.keepout, requirements: state.requirements };
}

async function save() {
  f.phase = 'public Save to browser project OPFS';
  const project = 'D582 keep-out interval';
  const file = 'D582-saved.bcad';
  await f.page.locator('.doc-tab input').fill('D582-saved');
  await button('Project and versions').click();
  const versions = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const bytes = Buffer.from(await f.page.evaluate(async ({ project, file }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, { project, file }));
  assert.deepEqual(JSON.parse(bytes.toString()), fixture);
  await writeFile(resolve(f.output, file), bytes);
  f.report.files.push({ file, sha256: sha256(bytes), semanticEquality: true, destination: 'OPFS' });
  await f.persist();
  return { file, bytes };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  f.report.expectation = repro ? 'repro' : 'fixed';
  const source = 'D582-source.bcad';
  const sourcePath = resolve(f.output, source);
  const bytes = Buffer.from(JSON.stringify(fixture));
  await writeFile(sourcePath, bytes, { flag: 'wx' });
  f.report.files.push({ file: source, sha256: sha256(bytes), destination: 'fixture' });
  await f.newPage();
  await open(source, bytes);
  const first = await check('01-original-open');
  const saved = await save();
  await f.newPage();
  await open(saved.file, saved.bytes);
  const reopened = await check('02-fresh-open');
  assert.deepEqual(reopened, first);
  assert.deepEqual(await readFile(sourcePath), bytes);
  assert.deepEqual(f.report.downloads, []);
});
