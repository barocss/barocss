// D742: real pointer picks on display primitives returned by the Studio Worker.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/measure-segment-face-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/ui/MeasurementInspector.tsx',
  'apps/cad-studio/src/viewport/useViewportPicking.ts',
  'packages/barocss-cad-model/src/app/measure.ts',
  'packages/barocss-cad-model/src/engine/mesh.ts',
  ...(baseline ? [] : [
    'packages/barocss-cad-model/src/app/measureIntersection.ts',
    'packages/barocss-cad-model/src/engine/binary64.ts',
  ]),
];
const f = await createFlow({
  name: 'measure-segment-face', output, envFrozen: 'D742_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce a nonzero Measure result at a finite crossing' : 'Measure a finite segment crossing without losing positive gaps',
  limits: ['Native prism inputs and the existing display-mesh Measure consumer.'],
  snapshotExtra: () => ({
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    historyControls: ['Undo', 'Redo'].map(name => {
      const el = document.querySelector(`button[aria-label="${name}"]`);
      return [el.disabled, el.getAttribute('data-tip')];
    }),
    overlay: window.__studioOverlayLines?.().measure ?? 0,
    measurement: document.querySelector('[aria-label="Measurement"]')?.textContent,
  }),
});

const fixture = from => ({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], id: 'n0' },
    { kind: 'extrude', sketch: 0, height: 10, id: 'n1' },
    { kind: 'sketch', profile: 'rectangle', min: [2, 4], max: [3, 5], id: 'n2' },
    { kind: 'extrude', sketch: 2, height: 2, from, id: 'n3' },
  ],
  outputs: { b1: { node: 1, side: 'solid' }, b3: { node: 3, side: 'solid' } }, nextId: 4,
});
function observeDisplayMeshes() {
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    evaluations = new Set();
    postMessage(request, options) {
      if (request.type === 'evaluate') this.evaluations.add(request.id);
      return super.postMessage(request, options);
    }
    get onmessage() { return super.onmessage; }
    set onmessage(listener) {
      super.onmessage = listener ? event => {
        const { id } = event.data ?? {};
        listener.call(this, event);
        const result = event.data?.result;
        if (result && this.evaluations.delete(id) && result.ok) window.__d742Meshes = result.bodies.map(body => body.mesh);
      } : null;
    }
  };
}

function containsStrictly([a, b, c], [x, y]) {
  const side = ([p, q], [r, s]) => (r - p) * (y - q) - (s - q) * (x - p);
  const signs = [side(a, b), side(b, c), side(c, a)];
  return signs.every(v => v > 0) || signs.every(v => v < 0);
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
    await context.addInitScript(observeDisplayMeshes);
    return context;
  };
  await f.newPage();
  const page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const panel = () => page.getByRole('complementary', { name: 'Measurement', exact: true });
  const metric = label => panel().locator('.kv').filter({ hasText: new RegExp('^' + label + '\\b') }).locator('b');
  const measure = async () => {
    await clickModelCommand(page, 'Inspect', 'Measure');
    await panel().waitFor();
    assert.equal(await panel().locator('.measure-item').count(), 0);
  };
  const closeMeasure = async () => {
    await page.keyboard.press('Escape');
    await panel().waitFor({ state: 'hidden' });
  };
  const open = async (name, doc) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: name + '.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await f.same(doc);
    await page.waitForFunction(() => window.__d742Meshes?.length === 2);
  };
  const click = async world => {
    const pixel = await page.evaluate(point => window.__studioScreenOf(point), world);
    await page.mouse.click(...pixel);
  };
  const pickFace = async () => {
    await button('Top').click();
    await f.frame([[0, 0], [10, 10]]);
    await click([7, 8, 10]);
    await panel().getByText('Planar face', { exact: true }).waitFor();
    assert.equal(await metric('Area').innerText(), '100 mm²');
  };
  const pickEdge = async from => {
    await button('Iso').click();
    await f.frame([[0, 0], [10, 10]]);
    const hit = await page.evaluate(z => {
      for (const [x, y] of [[2, 4], [3, 4], [3, 5], [2, 5]]) {
        const point = [x, y, z];
        const picked = window.__studioEdgeAt(point);
        const segment = picked?.segments.find(s => s[0] === x && s[1] === y && s[3] === x && s[4] === y);
        if (picked?.body === 1 && segment) return { point, edge: picked.edge, segment };
      }
      return null;
    }, from + 1.5);
    assert.ok(hit, 'one exposed upright edge of the smaller prism is pickable');
    const [x, y] = hit.point;
    assert.deepEqual([hit.segment[2], hit.segment[5]].sort((a, b) => a - b), [from, from + 2]);
    const support = await page.evaluate(edge => {
      const [mesh, pin] = window.__d742Meshes;
      const face = mesh.faces.find(f => f.name === 'n1.top');
      const triangles = [];
      for (let t = 0; t < mesh.indices.length; t += 3) {
        const indexes = Array.from(mesh.indices.slice(t, t + 3));
        if (mesh.faceOfVertex[indexes[0]] === face.index) triangles.push(indexes.map(i => Array.from(mesh.positions.slice(3 * i, 3 * i + 3))));
      }
      return { face: face.name, edge: pin.edges[edge].names, triangles };
    }, hit.edge);
    assert.ok(support.triangles.every(triangle => triangle.every(p => p[2] === 10)));
    assert.ok(support.triangles.some(triangle => containsStrictly(triangle, [x, y])), 'edge projection is strictly inside a current Worker triangle');
    await click(hit.point);
    await panel().getByText('Line', { exact: true }).waitFor();
    assert.equal(await metric('Length').innerText(), '2 mm');
    return { ...hit, ...support, expectedWitness: [x, y, 10] };
  };
  const check = async (name, from, order, before) => {
    f.phase = name;
    await measure();
    let support;
    for (const item of order) {
      if (item === 'face') await pickFace();
      else support = await pickEdge(from);
    }
    await panel().getByText('BETWEEN', { exact: true }).waitFor();
    const shown = Number.parseFloat(await metric('Distance').innerText());
    const expected = from === 9 ? 0 : 1;
    if (baseline && from === 9) assert.ok(shown > 0, 'parent reports a positive distance');
    else assert.equal(shown, expected);
    assert.equal(await metric('Angle').innerText(), '90°');
    await page.waitForFunction(expected => (window.__studioOverlayLines?.().measure ?? 0) === expected, shown ? 1 : 0);
    const after = await f.snapshot(name);
    for (const key of ['doc', 'bodies', 'history', 'historyControls', 'dirty']) assert.deepEqual(after[key], before[key], key);
    f.report.observations.push({ name, order, shown, expected, support, overlay: after.overlay });
    await closeMeasure();
  };

  const crossing = fixture(9);
  await open('crossing', crossing);
  const before = await f.snapshot('crossing-accepted');
  await check('face-to-edge', 9, ['face', 'edge'], before);
  await check('edge-to-face', 9, ['edge', 'face'], before);
  if (baseline) return;

  const project = 'D742 crossing fixture', file = 'crossing.bcad';
  const versions = () => page.getByRole('complementary', { name: 'Versions panel', exact: true });
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
  assert.deepEqual(JSON.parse(saved), crossing);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await versions().getByRole('button', { name: 'Close project', exact: true }).click();
  await versions().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await versions().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(crossing);
  await check('fresh-open-crossing', 9, ['face', 'edge'], await f.snapshot('saved-crossing'));

  const gap = fixture(11);
  await open('positive-gap', gap);
  await check('positive-gap', 11, ['edge', 'face'], await f.snapshot('gap-accepted'));
  assert.deepEqual(f.report.downloads, []);
});
