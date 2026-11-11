// D744: real desktop interference controls and controlled Worker reply cases.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/interference-result-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/MeasurementInspector.tsx',
  'apps/cad-studio/src/engine/client.ts',
  'apps/cad-studio/src/engine/engine.worker.ts',
  'packages/barocss-cad-model/src/engine/evaluate.ts',
  ...(baseline ? [] : ['apps/cad-studio/src/app/checkInterference.ts']),
];
const f = await createFlow({
  name: 'interference-result', output, envFrozen: 'D744_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce unchecked pairs reported as clear' : 'Preserve clear, overlapping and unchecked pairs',
  limits: ['Actual Studio and Worker. Transport substitutions are labelled controlled.'],
  inspectorSource: `
import { cylinderPart, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, evaluateVolumes } from '@barocss/cad-model/engine/evaluate';
import { captureSignatures } from '@barocss/cad-model/engine/references';
const input = JSON.parse(process.argv[3]);
let doc = input.doc;
if (input.wrap) {
  const base = cylinderPart(10, 30), cylinder = evaluateDoc(base, 1);
  if (!cylinder.ok) throw new Error(cylinder.error.detail);
  doc = captureSignatures(withNode(base, {
    kind:'cylindrical-wrap', parent:{node:1,side:'solid'}, faces:['n1.side0#2'],
    rectangle:{u:[0.1,0.4],v:[0.2,0.7]}, height:10,
  }), cylinder.bodies);
  const boxes = input.mixed ? [
    { min:[-12,-2], max:[-8,2], from:5, height:4 },
    { min:[-15,-1], max:[-11,3], from:7, height:3 },
  ] : [{ min:[-2,-2], max:[2,2], from:5, height:4 }];
  for (const { min,max,from,height } of boxes) {
    doc = withNode(doc, { kind:'sketch', profile:'rectangle', min,max });
    doc = withNode(doc, { kind:'extrude', sketch:doc.nodes.length-1, height,from });
  }
}
const rendered = evaluateDoc(doc, 1);
if (!rendered.ok) throw new Error(rendered.error.detail);
const [a,b] = rendered.bodies;
const probe = withNode(doc,{kind:'intersect',left:a.ref,right:b.ref});
const result = evaluateVolumes(probe, 'probe', probe.nodes.length - 1);
console.log(JSON.stringify({ doc, bounds:rendered.bodies.map(body=>body.mesh.bounds), result }));
`,
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => {
      const el = document.querySelector(`button[aria-label="${name}"]`);
      return [el.disabled, el.getAttribute('data-tip')];
    }),
    interference: document.querySelector('[aria-label="Interference"]')?.textContent,
  }),
});

const box = (x, y = 0) => ({ min: [x, y], max: [x + 10, y + 10], from: 0, height: 10 });
const triangle = (points, from) => ({ points, from, height: 3 });
function fixture(shapes, repeated = false) {
  const nodes = [], outputs = {}, bodies = {};
  for (const shape of shapes) {
    const n = nodes.length;
    const profile = shape.points
      ? { profile: 'loop', segments: shape.points.map(start => ({ kind: 'line', start })) }
      : { profile: 'rectangle', min: shape.min, max: shape.max };
    nodes.push({ kind: 'sketch', ...profile, id: 'n' + n });
    nodes.push({ kind: 'extrude', sketch: n, height: shape.height, from: shape.from, id: 'n' + (n + 1) });
    outputs['b' + (n + 1)] = { node: n + 1, side: 'solid' };
    if (repeated) bodies['b' + (n + 1)] = { name: 'Repeated' };
  }
  return { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes, outputs, nextId: nodes.length, ...(repeated ? { bodies } : {}) };
}

function observeProbes() {
  const NativeWorker = window.Worker;
  const queue = [], traces = [];
  let held;
  window.__d744 = {
    arm: steps => queue.push(...steps), traces,
    isHeld: () => !!held,
    release() { held(); held = undefined; },
  };
  window.Worker = class extends NativeWorker {
    probes = new Map();
    postMessage(request, options) {
      if (request.type === 'volumes') this.probes.set(request.id, queue.shift() ?? 'native');
      return super.postMessage(request, options);
    }
    get onmessage() { return super.onmessage; }
    set onmessage(listener) {
      super.onmessage = listener ? event => {
        const { id, volumes } = event.data ?? {};
        const mode = this.probes.get(id);
        if (!mode || volumes === undefined) return listener.call(this, event);
        this.probes.delete(id);
        traces.push({ id, mode, native: volumes });
        if (mode === 'native') return listener.call(this, event);
        if (mode === 'held-native') {
          held = () => listener.call(this, event);
          return;
        }
        const altered = { ...event.data };
        if (mode === 'stopped') delete altered.volumes;
        else if (mode === 'failure') altered.volumes = {
          ok: false, error: { title: 'Probe refused', hint: 'The controlled probe could not finish.', detail: 'Controlled Boolean refusal.', code: 'CAPABILITY' },
        };
        else {
          if (!volumes.ok || !volumes.volumes.length) throw new Error('Expected a real successful output for the controlled reply');
          const bad = { null: null, nan: NaN, infinite: Infinity, negative: -1, zero: 0 };
          altered.volumes = { ok: true, volumes: mode === 'missing' ? [] :
            volumes.volumes.map((row, i, all) => i === all.length - 1 ? { ...row, volume: bad[mode] } : row) };
        }
        listener.call(this, { data: altered });
      } : null;
    }
  };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    await context.addInitScript(observeProbes);
    return context;
  };
  await f.newPage();
  const page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const panel = () => page.getByRole('complementary', { name: 'Interference', exact: true });
  const open = async (name, doc) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    const bytes = Buffer.from(JSON.stringify(doc));
    await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: bytes });
    await f.same(doc);
    f.report.observations.push({ fixture: name, sha256: sha256(bytes) });
    return f.snapshot(name + '-accepted');
  };
  const close = async () => {
    await button('Close interference').click();
    await panel().waitFor({ state: 'hidden' });
  };
  const run = async (name, before, steps, expected) => {
    f.phase = name;
    const start = await page.evaluate(modes => {
      window.__d744.arm(modes);
      return window.__d744.traces.length;
    }, steps);
    await clickModelCommand(page, 'Inspect', 'Interference');
    await panel().waitFor();
    await panel().getByText(expected).waitFor();
    assert.equal(await panel().getByText('Checking…', { exact: true }).count(), 0);
    const snapshot = await f.snapshot(name);
    for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty']) assert.deepEqual(snapshot[key], before[key], key);
    const trace = await page.evaluate(start => window.__d744.traces.slice(start), start);
    f.report.observations.push({ name, trace, text: snapshot.interference });
    return trace;
  };
  const clear = 'No bodies overlap.';
  const nativeRefusal = async () => {
    const wrap = await f.inspect('native-refusal', {}, { wrap: true });
    assert.equal(wrap.result.ok, false);
    assert.match(wrap.result.error.detail, /cylindrical wrap reference cannot be consumed/i);
    const wrapBefore = await open('native-refusal', wrap.doc);
    const trace = await run('native-refused-pair', wrapBefore, [], baseline ? clear : /cylindrical wrap reference cannot be consumed/i);
    assert.equal(trace.length, 1);
    assert.equal(trace[0].native.ok, false);
    assert.equal(trace[0].native.error.feature, 'n5');
    assert.match(trace[0].native.error.detail, /cylindrical wrap/i);
    if (!baseline) assert.equal(await panel().getByText(clear, { exact: true }).count(), 0);
    await close();
  };
  const overlap = fixture([box(0), box(5)], true);
  const before = await open('ordinary-overlap', overlap);
  for (const [mode, expected] of [
    ['failure', 'Controlled Boolean refusal.'],
    ['null', 'Intersection volume is unavailable.'],
    ...(!baseline ? [
      ['missing', 'Intersection output is missing.'],
      ['nan', 'Intersection volume is invalid.'],
      ['infinite', 'Intersection volume is invalid.'],
      ['negative', 'Intersection volume is invalid.'],
      ['stopped', 'The worker stopped.'],
    ] : []),
  ]) {
    const trace = await run('controlled-' + mode, before, [mode], baseline ? clear : expected);
    assert.equal(trace.length, 1);
    assert.equal(trace[0].mode, mode);
    assert.equal(trace[0].native.ok, true);
    assert.ok(trace[0].native.volumes.some(row => Math.abs(row.volume - 500) < 1e-7));
    if (!baseline) {
      assert.equal(await panel().getByText(clear, { exact: true }).count(), 0);
      assert.match(await panel().innerText(), /Interference check failed/);
      const pair = panel().getByRole('button', { name: /Repeated \(b1\).*Repeated \(b3\)/ });
      await pair.click();
      await page.waitForFunction(() => window.__studioSelection.selection.bodies.join(',') === '0,1');
    }
    await close();
  }
  if (baseline) {
    await nativeRefusal();
    return;
  }

  const pendingRetry = run('same-part-successful-retry', before, ['held-native'], /500 mm³/);
  await panel().getByText('Checking…', { exact: true }).waitFor();
  await page.waitForFunction(() => window.__d744.isHeld());
  assert.equal(await panel().getByText(clear, { exact: true }).count(), 0);
  await page.evaluate(() => window.__d744.release());
  const retry = await pendingRetry;
  assert.equal(retry[0].native.ok, true);
  assert.equal(await panel().getByText(/check failed|check incomplete/).count(), 0);
  await panel().getByRole('button', { name: /Repeated \(b1\).*Repeated \(b3\)/ }).click();
  await page.waitForFunction(() => window.__studioSelection.selection.bodies.join(',') === '0,1');
  await close();

  await run('controlled-measured-zero', before, ['zero'], clear);
  await close();

  const disjoint = fixture([box(0), box(12)]);
  assert.deepEqual(await run('bounds-clear', await open('bounds-clear', disjoint), [], clear), []);
  await close();

  const empty = fixture([triangle([[0,0],[4,0],[0,4]], 0), triangle([[1,4],[4,1],[4,4]], 1), box(20)]);
  const emptySource = await f.inspect('native-empty', {}, { doc: empty });
  assert.ok(emptySource.result.ok);
  assert.equal(emptySource.result.emptyIntersection, 'b6');
  assert.ok(emptySource.result.volumes.some(row => row.key === 'b5' && Math.abs(row.volume - 1000) < 1e-7));
  const emptyTrace = await run('native-empty', await open('triangle-prisms', empty), [], clear);
  assert.equal(emptyTrace[0].native.emptyIntersection, 'b6');
  await close();

  const partial = fixture([box(0), box(5), box(12)]);
  const partialBefore = await open('partial', partial);
  const partialTrace = await run('controlled-partial', partialBefore, ['native', 'failure'], /Interference check incomplete/);
  assert.equal(partialTrace.length, 2);
  assert.ok(partialTrace[0].native.volumes.some(row => Math.abs(row.volume - 500) < 1e-7));
  assert.ok(partialTrace[1].native.volumes.some(row => Math.abs(row.volume - 300) < 1e-7));
  assert.match(await panel().innerText(), /500 mm³/);
  assert.match(await panel().innerText(), /Controlled Boolean refusal/);
  assert.equal(await panel().getByText(clear, { exact: true }).count(), 0);
  await close();

  const rows = page.locator('.outliner .ol-row button.ol');
  await rows.nth(1).click();
  await rows.nth(2).click({ modifiers: ['Shift'] });
  await page.waitForFunction(() => window.__studioSelection.selection.bodies.join(',') === '1,2');
  const selected = await run('selected-pair-only', partialBefore, [], /300 mm³/);
  assert.equal(selected.length, 1);
  assert.equal(await panel().getByText(/500 mm³/).count(), 0);
  await close();

  const mixed = await f.inspect('native-mixed', {}, { wrap: true, mixed: true });
  const mixedBefore = await open('native-mixed', mixed.doc);
  const mixedTrace = await run('native-mixed', mixedBefore, [], /Interference check incomplete/);
  assert.equal(mixedTrace.length, 2);
  assert.equal(mixedTrace[0].native.ok, false);
  assert.match(mixedTrace[0].native.error.detail, /cylindrical wrap reference cannot be consumed/i);
  assert.ok(mixedTrace[1].native.volumes.some(row => Math.abs(row.volume - 6) < 1e-7));
  await panel().getByRole('button', { name: /6 mm³/ }).click();
  await page.waitForFunction(() => window.__studioSelection.selection.bodies.join(',') === '1,2');
  await close();

  f.phase = 'Save and reopen the authored mixed part';
  const versions = () => page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const project = 'D744 Interference fixture', file = 'native-mixed.bcad';
  const attach = async () => {
    if (!(await versions().isVisible())) await button('Project and versions').click();
    await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await versions().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions().getByLabel('Project', { exact: true }).waitFor();
  };
  await attach();
  await button('Save').click();
  await versions().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await page.evaluate(async ([name, file]) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(name);
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, [project, file]);
  assert.deepEqual(JSON.parse(saved), mixed.doc);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await versions().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(mixed.doc);
  const reopened = await f.snapshot('reopened-mixed-source');
  const reopenedTrace = await run('reopened-native-mixed', reopened, [], /Interference check incomplete/);
  assert.deepEqual(reopenedTrace.map(trace => trace.native), mixedTrace.map(trace => trace.native));
  await close();

  await nativeRefusal();
  assert.deepEqual(f.report.downloads, []);
});
