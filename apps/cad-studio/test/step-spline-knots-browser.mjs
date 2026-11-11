// D722: actual STEP Open reads the worker's typed refusals and preserves the last accepted solid.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';
import { cylinderStep } from '../../../packages/barocss-cad/test/step-fixtures.mjs';
import { knotBoxStep, knotCurveStep, stepSolidGraph } from '../../../packages/barocss-cad/test/step-spline-knot-fixtures.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/step-spline-knots-browser.mjs',
  'apps/cad-studio/src/files/importedFile.ts',
  'apps/cad-studio/src/engine/client.ts',
  'packages/barocss-cad/test/step-spline-knot-fixtures.mjs',
  'packages/barocss-cad/src/io/step-import.ts',
  'packages/barocss-cad/src/part/part-mesh.ts',
];
const f = await createFlow({
  name: 'step-spline-knots', output, envFrozen: 'D722_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce the unexpected exception on a reached STEP complex spline' : 'Distinguish unsupported and malformed STEP complex spline knot forms',
  limits: ['Self-authored native STEP controls and actual desktop Open on the normal worker path.'],
  inspectorSource: `
import { BrepError, checkBrep, brepMassProperties, evaluateCadPart, exportStep, importStep } from '@barocss/cad';
const { text } = JSON.parse(process.argv[3]);
if (!text) {
  const box = evaluateCadPart({ format:'barocss-cad-part',version:1,units:'mm',parameters:{},features:[
    {id:'s',kind:'sketch',profile:'rectangle',min:[0,0],max:[10,8]},
    {id:'e',kind:'extrude',sketch:'s',height:5},
  ] });
  console.log(JSON.stringify({ step:exportStep(box.outputs[0].brep) }));
  process.exit(0);
}
function read(fn) {
  try { return fn(); }
  catch (error) { return { name:error.name, code:error.code, message:error.message, details:error.details, feature:error.feature, brepError:error instanceof BrepError }; }
}
console.log(JSON.stringify({
  direct:read(() => {
    const brep = importStep(text);
    return { valid:checkBrep(brep,{strict:true}).valid, volume:brepMassProperties(brep,1).volume, faceNames:brep.faces.map(face=>face.name) };
  }),
  part:read(() => {
    const result = evaluateCadPart({ format:'barocss-cad-part',version:1,units:'mm',parameters:{},features:[{ id:'imported',kind:'import',step:text }] });
    return { outputs:result.outputs.map(output=>output.id) };
  }),
}));
`,
});

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
    await context.addInitScript(() => {
      const NativeWorker = window.Worker;
      const reply = [];
      window.__d722Reads = reply;
      window.Worker = class extends NativeWorker {
        reads = new Map();
        postMessage(request, options) {
          if (request.type === 'part' && request.slot === 'read') this.reads.set(request.id, request.revision);
          return super.postMessage(request, options);
        }
        set onmessage(listener) {
          super.onmessage = listener ? event => {
            const { id, result } = event.data ?? {};
            if (result && this.reads.has(id)) {
              reply.push({ id, revision: this.reads.get(id), ok: result.ok, detail: result.error?.detail });
              this.reads.delete(id);
            }
            listener.call(this, event);
          } : null;
        }
        get onmessage() { return super.onmessage; }
      };
    });
    return context;
  };
  await f.newPage();
  const page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const open = async (name, text) => {
    const file = join(output, name + '.step');
    await writeFile(file, text);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(file);
  };
  const opened = async text => {
    await f.waitToast(/STEP opened.*1 solid/);
    await page.waitForFunction(expected => window.__studioDoc.nodes[0]?.step === expected, text);
    await f.ready();
  };
  const historyTips = () => Promise.all(['Undo', 'Redo'].map(name => button(name).getAttribute('data-tip')));
  const cylinder = cylinderStep();
  const control = await f.inspect('cylinder', {}, { text: cylinder });
  assert.equal(control.direct.valid, true);
  assert.ok(Math.abs(control.direct.volume - 250 * Math.PI) < 1e-7);
  await open('analytic-cylinder', cylinder);
  await opened(cylinder);
  await page.locator('.ol-row').filter({ has: page.locator('button.ol-eye') }).locator('button.ol').click();
  const accepted = await f.snapshot('analytic-accepted');
  assert.deepEqual(accepted.selection.selection.bodies, [0]);
  const undo = await historyTips();
  const dirty = await page.locator('[aria-label="Unsaved changes"]').count();
  await f.dismissToasts();

  const implicit = knotCurveStep('edge', 'QUASI_UNIFORM_CURVE', { weights: [1, 1, 1] });
  const graph = stepSolidGraph(implicit.text);
  assert.ok(graph.reached.has(implicit.target));
  assert.ok(graph.incoming(implicit.target).some(entity => entity.startsWith('EDGE_CURVE(')));
  assert.ok(!graph.incoming(implicit.target).some(entity => entity.startsWith('SURFACE_OF_')));
  f.phase = 'Open the reached QUASI_UNIFORM_CURVE';
  const oracle = await f.inspect('implicit-curve', {}, { text: implicit.text });
  if (baseline) {
    assert.equal(oracle.direct.name, 'TypeError');
    assert.equal(oracle.part.code, 'GEOMETRY');
    assert.match(oracle.part.message, /unexpected kernel failure/i);
  } else {
    assert.equal(oracle.direct.brepError, true);
    assert.equal(oracle.direct.code, 'INPUT');
    assert.equal(oracle.part.code, 'CAPABILITY');
    assert.match(oracle.part.message, /QUASI_UNIFORM_CURVE.*not supported/i);
  }
  await open('implicit-curve', implicit.text);
  const expected = baseline ? /unexpected kernel failure/i : /QUASI_UNIFORM_CURVE.*not supported/i;
  await f.waitToast(expected);
  const after = await f.snapshot('implicit-refusal');
  assert.deepEqual(after.doc, accepted.doc);
  assert.deepEqual(after.bodies.bodies, accepted.bodies.bodies);
  assert.deepEqual(after.history, accepted.history);
  assert.deepEqual(after.selection.selection, accepted.selection.selection);
  assert.deepEqual(await historyTips(), undo);
  assert.equal(await page.locator('[aria-label="Unsaved changes"]').count(), dirty);
  const trace = await page.evaluate(() => window.__d722Reads.at(-1));
  assert.equal(trace.ok, false);
  assert.match(trace.detail, expected);
  f.report.observations.push({ curveTarget: implicit.target, direct: oracle.direct, part: oracle.part, worker: trace });
  if (baseline) return;

  f.phase = 'Open a reached surface with no knot-form component';
  const source = await f.inspect('box-source', {}, {});
  const malformed = knotBoxStep(source.step, 'SURFACE', 'missing', { weights: [[1, 1], [1, 1]] });
  const surfaceGraph = stepSolidGraph(malformed.text);
  assert.ok(surfaceGraph.reached.has(malformed.target));
  assert.ok(surfaceGraph.incoming(malformed.target).some(entity => entity.startsWith('ADVANCED_FACE(')));
  const surfaceRefusal = await f.inspect('missing-surface', {}, { text: malformed.text });
  const missing = /complex B-spline surface #\d+ is missing a knot-form component/i;
  assert.equal(surfaceRefusal.direct.brepError, true);
  assert.equal(surfaceRefusal.direct.code, 'INPUT');
  assert.match(surfaceRefusal.direct.message, missing);
  assert.equal(surfaceRefusal.part.code, 'INPUT');
  assert.equal(surfaceRefusal.part.feature, 'imported');
  await f.dismissToasts();
  await open('missing-surface', malformed.text);
  await f.waitToast(missing);
  const stillAccepted = await f.snapshot('malformed-refusal');
  assert.deepEqual(stillAccepted.doc, accepted.doc);
  assert.deepEqual(stillAccepted.bodies.bodies, accepted.bodies.bodies);
  assert.deepEqual(stillAccepted.history, accepted.history);
  assert.deepEqual(stillAccepted.selection.selection, accepted.selection.selection);
  assert.deepEqual(await historyTips(), undo);
  assert.equal(await page.locator('[aria-label="Unsaved changes"]').count(), dirty);
  const worker = await page.evaluate(() => window.__d722Reads.at(-1));
  assert.equal(worker.ok, false);
  assert.match(worker.detail, missing);
  f.report.observations.push({ surfaceTarget: malformed.target, direct: surfaceRefusal.direct, part: surfaceRefusal.part, worker });

  f.phase = 'Open an explicit rational STEP control and continue editing';
  const supported = knotBoxStep(source.step, 'SURFACE', 'explicit', { weights: [[1, 2], [3, 6]] });
  const native = await f.inspect('supported-explicit-native', {}, { text: supported.text });
  assert.equal(native.direct.valid, true);
  assert.ok(Math.abs(native.direct.volume - 400) < 1e-7);
  assert.deepEqual(native.part.outputs, ['imported']);
  await f.dismissToasts();
  await open('supported-explicit', supported.text);
  await opened(supported.text);
  const replacement = await f.snapshot('supported-reopened');
  assert.equal(replacement.doc.nodes[0].step, supported.text);
  assert.equal(replacement.doc.units, 'mm');
  assert.equal(replacement.bodies.bodies.length, 1);
  assert.ok(Math.abs(replacement.bodies.bodies[0].volume - 400) < 1e-7);
  const boxRow = page.locator('.ol-row').filter({ has: page.locator('button.ol-eye') }).locator('button.ol');
  await boxRow.dblclick();
  const name = page.getByRole('textbox', { name: 'Body name', exact: true });
  await name.fill('Recovered STEP body');
  await name.press('Enter');
  await f.changed(replacement.doc);
  const renamed = await f.snapshot('supported-edited');
  assert.equal(renamed.doc.bodies[renamed.bodies.bodies[0].key].name, 'Recovered STEP body');
  assert.deepEqual(renamed.doc.nodes, replacement.doc.nodes);
  assert.deepEqual(renamed.bodies.bodies, replacement.bodies.bodies);
  await f.undo();
  await f.same(replacement.doc);
  await f.redo();
  await f.same(renamed.doc);
});
