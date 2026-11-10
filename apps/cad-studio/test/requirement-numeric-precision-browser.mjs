// D578 / #2411. Run under the heavy gate from apps/cad-studio.
// D578_SOURCE_FROZEN=1 node test/requirement-numeric-precision-browser.mjs EXTERNAL_OUTPUT --expect=repro|pending-repro|fixed
import assert from 'node:assert/strict';
import { isAbsolute, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--expect=repro', '--expect=pending-repro', '--expect=fixed'].includes(mode));
const repro = mode === '--expect=repro';
const step = 1 / 4096;
const width = 40 + step;
const cap = 40 + step / 2;
const moved = 2 * step;
const taller = 1 + step;
const limit = (id, source, query, value, unit, hard = false) => ({
  id, source, hard, basis: 'stated', check: { op: '<=', query, value, unit },
});
const base = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [width, 1], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 1, id: 'n1' },
  ],
  outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2, bodies: { b1: { material: 'al6061' } },
  requirements: [
    limit('X-CAP', 'Width cap', { fn: 'bbox', axis: 'x' }, cap, 'mm'),
    { id: 'X-EQUAL', source: 'Required width', hard: false, basis: 'stated',
      check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: width, tol: 1e-6, unit: 'mm' } },
    limit('V-CAP', 'Volume cap', { fn: 'volume' }, cap, 'mm³'),
    limit('M-CAP', 'Mass cap', { fn: 'mass' }, 0.1080003, 'g'),
    limit('Z-CAP', 'Height cap', { fn: 'bbox', axis: 'z' }, 1 + step / 2, 'mm', true),
  ],
};
const translated = { ...base, nodes: [...base.nodes, { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [moved, 0, 0], id: 'n2' }],
  outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3 };
const oracleSource = String.raw`
import json, math, sys
from fractions import Fraction as F
data = json.load(sys.stdin)
doc, observed = data['doc'], data['observed']
w, d = map(F, doc['nodes'][0]['max'])
h = F(doc['nodes'][1]['height'])
offset = F(doc['nodes'][2]['offset'][0]) if len(doc['nodes']) == 3 else F(0)
volume, mass = w*d*h, w*d*h*F('2.7')/1000
body, = data['bodies']
assert math.isclose(body['volume'], float(volume), abs_tol=1e-9, rel_tol=0), body
center = [float(offset+w/2), float(d/2), float(h/2)]
assert all(math.isclose(a,b,abs_tol=1e-9,rel_tol=0) for a,b in zip(body['centroid'],center,strict=True)), body
expected = {}
for r, x in zip(doc['requirements'], [w,w,volume,mass,h], strict=True):
    p = r['check']
    delta = x - F(p['value'])
    assert abs(delta) > F('1e-7') or delta == 0, delta
    ok = abs(delta) <= F(p['tol']) if p['op'] == '==' else delta <= 0
    expected[r['id']] = 'pass' if ok else 'fail'
differences = [key for key in expected if expected[key] != observed[key]]
assert differences == data['differences'], (differences, expected, observed)
print(json.dumps({'status':'PASS','expected':expected,'observed':observed,'differences':differences,
                  'width':float(w),'volume':float(volume),'mass':float(mass),'centroid':center,'absoluteTolerance':1e-9}))
`;
const pins = ['apps/cad-studio/test/requirement-numeric-precision-browser.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/state/useModelChecks.ts', 'apps/cad-studio/src/ui/RequirementsBrowser.tsx',
  'packages/barocss-cad-model/src/chat/spec.ts', 'packages/barocss-cad-model/src/chat/observe.ts',
  'packages/barocss-cad-model/src/chat/toolKit.ts'];
const f = await createFlow({
  name: 'requirement-numeric-precision', envFrozen: 'D578_SOURCE_FROZEN', output, qualification: 'D578 #2411 desktop',
  initialFiles: pins, requiredFrozen: pins, oracleSource,
  limits: ['Native rectangular extrusion and translation. Worker volume and centroid compared to exact box arithmetic. Mass oracle uses the assigned al6061 density. Project Save to local OPFS.'],
  snapshotExtra: () => ({
    requirements: Object.fromEntries([...document.querySelectorAll('.req[aria-label]')].map(row =>
      [row.getAttribute('aria-label').replace('Requirement ', ''), row.classList[1]])),
    summary: document.querySelector('.req-head .muted')?.textContent,
    heldMassReplies: window.__d578MassHold.count(),
  }),
});
const button = name => f.page.getByRole('button', { name, exact: true });
const expected = ({ shifted = false, edited = false } = {}) => Object.fromEntries(base.requirements.map(({ id }, i) => [
  id, (repro ? [shifted, true, edited, false, false] : [true, false, true, true, edited])[i] ? 'fail' : 'pass',
]));

async function open(name, bytes, doc) {
  f.phase = 'public Open ' + name;
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/octet-stream', buffer: bytes });
  await f.same(doc);
}

async function check(label, doc, options) {
  f.phase = label;
  await f.same(doc);
  const outcomes = expected(options);
  const failures = Object.values(outcomes).filter(status => status === 'fail').length;
  const summary = `${base.requirements.length - failures} ✓ · ${failures} ✗ · 0 ?`;
  await f.page.waitForFunction(({ outcomes, summary }) => {
    if (document.querySelector('.req-head .muted')?.textContent !== summary) return false;
    return [...document.querySelectorAll('.req[aria-label]')].every(row =>
      row.classList.contains(outcomes[row.getAttribute('aria-label').replace('Requirement ', '')]));
  }, { outcomes, summary });
  const state = await f.snapshot(label);
  assert.deepEqual(state.requirements, outcomes);
  assert.equal(state.summary, summary);
  assert.deepEqual(state.doc.requirements, base.requirements);
  if (!repro) {
    const row = f.page.getByRole('listitem', { name: 'Requirement M-CAP', exact: true });
    assert.match(await row.locator('.req-row').getAttribute('title'), /measured 0\.108\d+ g before display rounding/);
  }
  assert.equal(state.bodies.bodies[0]?.key, options?.shifted ? 'b2' : 'b1');
  const differences = repro ? [...(!options?.shifted ? ['X-CAP'] : []), 'X-EQUAL', ...(!options?.edited ? ['V-CAP'] : []), 'M-CAP', ...(options?.edited ? ['Z-CAP'] : [])] : [];
  return f.runOracle({ doc: state.doc, bodies: state.bodies.bodies, observed: state.requirements, differences }, label);
}

function installMassHold() {
  let owner = Worker.prototype;
  while (owner && !Object.hasOwn(owner, 'onmessage')) owner = Object.getPrototypeOf(owner);
  const descriptor = owner && Object.getOwnPropertyDescriptor(owner, 'onmessage');
  if (!descriptor?.set) throw new Error('Worker onmessage setter required');
  let armed = false;
  const held = [];
  Object.defineProperty(Worker.prototype, 'onmessage', {
    configurable: true, get: descriptor.get,
    set(callback) {
      if (!callback) {
        descriptor.set.call(this, callback);
        return;
      }
      descriptor.set.call(this, function (event) {
        if (armed && Array.isArray(event.data?.masses)) held.push(() => callback.call(this, event));
        else callback.call(this, event);
      });
    },
  });
  window.__d578MassHold = {
    arm() { if (armed || held.length) throw new Error('One mass window at a time'); armed = true; },
    release() { armed = false; for (const deliver of held.splice(0)) deliver(); },
    count: () => held.length,
  };
}

async function checkDeferredWarnings() {
  const doc = { ...base, requirements: [
    limit('V-WARN', 'Volume cap during edit', { fn: 'volume' }, 40.005, 'mm³', true),
    limit('M-WARN', 'Body mass cap during edit', { fn: 'mass', body: 'b1' }, 0.10801, 'g', true),
  ] };
  await f.newPage();
  await open('D578-pending-controls', Buffer.from(JSON.stringify(doc)), doc);
  const summary = f.page.locator('.req-head .muted');
  const waitSummary = text => summary.filter({ hasText: new RegExp('^' + text.replace('?', '\\?') + '$') }).waitFor();
  await waitSummary('2 ✓ · 0 ✗ · 0 ?');
  await f.openFeatureEditor(1, 'extrusion with deferred mass');
  await f.editor().getByRole('spinbutton', { name: 'Distance', exact: true }).fill(String(taller));
  await f.page.evaluate(() => window.__d578MassHold.arm());
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  f.phase = 'actual Worker mass reply held after accepting edited geometry';
  await f.page.waitForFunction(height => {
    const state = window.__studioBodies?.();
    return window.__studioDoc.nodes[1]?.height === height && window.__studioFresh && state?.fresh
      && !state.massReady && state.bodies[0]?.volume === null && window.__d578MassHold.count() > 0;
  }, taller);
  await waitSummary('0 ✓ · 0 ✗ · 2 ?');
  const pending = await f.snapshot('07-deferred-unknown');
  assert.deepEqual(pending.requirements, { 'V-WARN': 'unknown', 'M-WARN': 'unknown' });
  assert.ok(!pending.notices.some(t => t.includes('V-WARN, M-WARN now fail')));
  await f.page.evaluate(() => window.__d578MassHold.release());
  await f.ready();
  await waitSummary('0 ✓ · 2 ✗ · 0 ?');
  const settled = await f.snapshot('08-deferred-resolved');
  assert.deepEqual(settled.doc, pending.doc);
  assert.deepEqual(settled.requirements, { 'V-WARN': 'fail', 'M-WARN': 'fail' });
  assert.ok(Math.abs(settled.bodies.bodies[0].volume - width * taller) < 1e-9);
  const warning = settled.notices.find(t => t.includes('V-WARN, M-WARN now fail'));
  if (mode === '--expect=pending-repro') assert.equal(warning, undefined);
  else assert.match(warning, /Your change is kept/);
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.addInitScript(installMassHold);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  f.report.runtimeOwnership = { nodePID: process.pid, serverURL: origin };
  await f.newPage();
  const bytes = doc => Buffer.from(JSON.stringify(doc));
  await open('D578-translated', bytes(translated), translated);
  await check('01-translated', translated, { shifted: true });
  await open('D578-origin', bytes(base), base);
  await check('02-origin', base);

  await f.openFeatureEditor(1, 'extrusion');
  await f.editor().getByRole('spinbutton', { name: 'Distance', exact: true }).fill(String(taller));
  await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
  await f.changed(base);
  await f.closeEditor();
  const edited = await f.doc();
  assert.equal(edited.nodes[1].height, taller);
  await check('03-edited', edited, { edited: true });
  if (repro) assert.ok(!(await f.toasts()).some(toast => /Z-CAP now fails/.test(toast)));
  else assert.match(await f.waitToast(/Z-CAP now fails/), /Your change is kept/);

  await f.undo();
  await check('04-undo', base);
  await f.redo();
  await check('05-redo', edited, { edited: true });

  f.phase = 'Save edited model to browser project';
  const project = 'D578 requirement precision', file = 'D578-saved.bcad';
  await f.page.locator('.doc-tab input').fill('D578-saved');
  await button('Project and versions').click();
  const panel = f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await panel.getByLabel('Project', { exact: true }).waitFor();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await f.page.evaluate(async ({ project, file }) => {
    const root = await navigator.storage.getDirectory();
    const projects = await root.getDirectoryHandle('projects');
    const folder = await projects.getDirectoryHandle(project);
    return (await (await folder.getFileHandle(file)).getFile()).text();
  }, { project, file });
  assert.deepEqual(JSON.parse(saved), edited);
  f.report.files.push({ file, sha256: sha256(saved), semanticEquality: true, destination: 'OPFS' });
  await f.newPage();
  await open('D578-saved', Buffer.from(saved), edited);
  await check('06-fresh-open', edited, { edited: true });
  if (!repro) await checkDeferredWarnings();
  assert.deepEqual(f.report.downloads, []);
});
