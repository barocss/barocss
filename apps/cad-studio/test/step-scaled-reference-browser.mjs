// D724: add supported non-mm STEP references through the actual Studio worker.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { withLengthConversion } from './step-length-fixture.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/step-scaled-reference-browser.mjs',
  'apps/cad-studio/test/step-length-fixture.mjs',
  'apps/cad-studio/src/state/useSpecificationActions.ts',
  'packages/barocss-cad-model/src/chat/references.ts',
  'packages/barocss-cad-model/src/engine/stepUnits.ts',
];
const f = await createFlow({
  name: 'step-scaled-reference', output, envFrozen: 'D724_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce a valid inch reference rejected by the worker' : 'Accept known STEP scales with the actual solid count',
  limits: ['Locally generated exact STEP boxes. The worker and the Reference Bodies panel are the normal Studio paths.'],
  inspectorSource: `
import { evaluateCadPart, exportStep } from '@barocss/cad';
const boxes = [[[0,0],[2,3],4], [[10,0],[13,2],2], [[20,0],[21,4],2]];
const outputs = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
  features: boxes.flatMap(([min,max,height], i) => [
    { id: 'sketch' + i, kind: 'sketch', profile: 'rectangle', min, max },
    { id: 'box' + i, kind: 'extrude', sketch: 'sketch' + i, height },
  ]),
}).outputs;
const options = { timestamp: '2026-11-12T00:00:00Z', validationProperties: false };
console.log(JSON.stringify({ single: exportStep(outputs[0].brep, options), multiple: exportStep(outputs.map(o => o.brep), options) }));
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
      const replies = window.__d724Replies = [];
      window.Worker = class extends NativeWorker {
        pending = new Map();
        postMessage(request, options) {
          if (request.type === 'part' && request.slot === 'read') this.pending.set(request.id, request.doc.added.map(([, node]) => ({
            id: node.id, kind: node.kind, solids: node.solids, factor: node.factor,
          })));
          return super.postMessage(request, options);
        }
        set onmessage(listener) {
          super.onmessage = listener ? event => {
            const { id, result } = event.data ?? {};
            const nodes = this.pending.get(id);
            if (nodes && result) {
              replies.push({ nodes, ok: result.ok, detail: result.error?.detail, bodies: result.bodies?.map(body => ({
                volume: body.volume, bounds: body.mesh?.bounds, centroid: body.centroid,
              })) });
              this.pending.delete(id);
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
  let page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const add = (name, text) => page.getByLabel('Add reference', { exact: true }).setInputFiles({
    name: name + '.step', mimeType: 'application/step', buffer: Buffer.from(text),
  });
  const open = async file => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(file);
  };
  const sources = await f.inspect('exact-boxes', {}, {});
  const inch = withLengthConversion(sources.single, 'INCH');
  const foot = withLengthConversion(sources.multiple, 'FOOT', 304.8);
  assert.equal([...foot.source.matchAll(/=MANIFOLD_SOLID_BREP\(/g)].length, 3);
  f.report.observations.push({ inchSHA256: inch.sha256, footSHA256: foot.sha256 });
  const part = join(output, 'reference-study.step');
  await writeFile(part, sources.single);
  await open(part);
  await f.waitToast(/STEP opened.*1 solid, in millimetres/);
  await f.ready();
  const before = await f.snapshot('main-part');
  await f.dismissToasts();
  const trace = () => page.evaluate(() => window.__d724Replies);
  let offset = (await trace()).length;

  f.phase = 'Add a single solid in inches';
  await add('inch-reference', inch.source);
  if (baseline) {
    await f.waitToast(/Reference not changed.*ref1\/1 is not a part/);
    const refused = await f.snapshot('parent-inch-reference-refused');
    assert.deepEqual(refused.doc, before.doc);
    const reads = (await trace()).slice(offset);
    assert.deepEqual(reads.map(read => read.ok), [true, false]);
    assert.match(reads[1].detail, /ref1\/1 is not a part/);
    f.report.observations.push({ parent: reads });
    return;
  }

  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-11), JSON.stringify({ actual, expected }));
  const geometry = (replies, factor, dimensions, centers) => {
    const final = replies.find(read => read.ok && read.nodes.some(node => node.factor === factor));
    assert.ok(final, JSON.stringify(replies));
    assert.equal(final.bodies.length, dimensions.length);
    final.bodies.sort((a, b) => a.centroid[0] - b.centroid[0]).forEach((body, i) => {
      near(body.volume, dimensions[i].reduce((volume, size) => volume * size, factor ** 3));
      body.centroid.forEach((value, axis) => near(value, centers[i][axis] * factor));
      assert.ok(body.bounds, 'the first scaled reply supplies the mesh');
      body.bounds.max.forEach((value, axis) => near(value - body.bounds.min[axis], dimensions[i][axis] * factor));
    });
  };
  const waitRef = async (id, faces) => {
    await page.getByRole('listitem', { name: 'Reference ' + id, exact: true }).getByText(new RegExp(faces + ' faces')).waitFor();
    await f.ready();
  };
  const readNew = async (start, id) => {
    await page.waitForFunction(({ start, id }) => window.__d724Replies.slice(start)
      .filter(read => read.nodes.some(node => node.id === id)).length >= 2, { start, id });
    return (await trace()).slice(start).filter(read => read.nodes.some(node => node.id === id)).slice(0, 2);
  };
  await waitRef('ref1', 6);
  const single = await f.snapshot('inch-reference-added');
  assert.deepEqual(single.doc.nodes, before.doc.nodes);
  assert.deepEqual(single.bodies.bodies, before.bodies.bodies);
  assert.deepEqual(single.doc.references.references[0].source, { step: inch.source });
  assert.equal(single.doc.references.references[0].solids, undefined);
  const inchReads = await readNew(offset, 'ref1');
  assert.deepEqual(inchReads[0].nodes.map(node => node.kind), ['import']);
  assert.equal(inchReads[0].bodies.length, 1);
  geometry(inchReads, 25.4, [[2, 3, 4]], [[1, 1.5, 2]]);

  const z = page.getByRole('spinbutton', { name: 'ref1 position z', exact: true });
  await z.fill('17');
  await z.press('Enter');
  await page.waitForFunction(() => window.__studioDoc.references.references[0].at.position[2] === 17);
  await waitRef('ref1', 6);

  f.phase = 'Add three disjoint STEP solids in feet';
  offset = (await trace()).length;
  await add('foot-reference', foot.source);
  await waitRef('ref2', 18);
  const multi = await f.snapshot('foot-reference-three-solids');
  assert.deepEqual(multi.doc.nodes, before.doc.nodes);
  assert.deepEqual(multi.bodies.bodies, before.bodies.bodies);
  assert.equal(multi.doc.references.references[1].solids, 3);
  assert.deepEqual(multi.doc.references.references[1].source, { step: foot.source });
  const footReads = await readNew(offset, 'ref2');
  assert.deepEqual(footReads[0].nodes.map(node => node.kind), ['import']);
  assert.equal(footReads[0].bodies.length, 3);
  assert.equal(footReads[1].nodes.filter(node => node.factor === 304.8).length, 3);
  geometry(footReads, 304.8, [[2, 3, 4], [3, 2, 2], [1, 4, 2]], [[1, 1.5, 2], [11.5, 1, 1], [20.5, 2, 1]]);
  f.report.observations.push({ inchReads, footReads });

  f.phase = 'Undo and redo the foot reference through Studio';
  await f.undo();
  await page.waitForFunction(() => window.__studioDoc.references.references.length === 1);
  await f.redo();
  await f.same(multi.doc);
  await waitRef('ref2', 18);

  f.phase = 'Save the original STEP sources and reload both references';
  const project = 'D724 STEP references';
  await button('Project and versions').click();
  const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await button('Save').click();
  const savedName = 'reference-study.bcad';
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(savedName, { exact: true }).waitFor();
  const native = await page.evaluate(async ({ project, savedName }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(savedName)).getFile()).text();
  }, { project, savedName });
  assert.deepEqual(JSON.parse(native), multi.doc);
  const saved = join(output, savedName);
  await writeFile(saved, native);
  await f.newPage();
  page = f.page;
  await open(saved);
  await f.same(multi.doc);
  await waitRef('ref1', 6);
  await waitRef('ref2', 18);
  const reopened = await f.snapshot('fresh-open-with-both-references');
  assert.deepEqual(reopened.bodies.bodies, before.bodies.bodies);
  const replay = await trace();
  geometry(replay, 25.4, [[2, 3, 4]], [[1, 1.5, 2]]);
  geometry(replay, 304.8, [[2, 3, 4], [3, 2, 2], [1, 4, 2]], [[1, 1.5, 2], [11.5, 1, 1], [20.5, 2, 1]]);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ nativeSHA256: sha256(native), replay });
});
