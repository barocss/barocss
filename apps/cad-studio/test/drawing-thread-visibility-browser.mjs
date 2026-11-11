// Desktop acceptance for #2421. Run under the heavy gate with D700_SOURCE_FROZEN=1.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--baseline', '--fixed'].includes(mode));
await mkdir(output, { recursive: true });
const oracle = join(import.meta.dirname, 'drawing-thread-visibility-reader.py');
const reference = { id: 'tap', kind: 'diameter', view: 'front', edge: 'n1.side2|n2.side0#2', near: [10, 32, 4], place: [22, 15] };
const openingSignature = { k: 'curve', n: 2, p: [10, 32, 1.5], s: 0 };
const seed = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 32] },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 8 },
    { id: 'n2', kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 4], radius: 2.5, depth: 5, axis: 'y', side: 'max', thread: 'M6×1' },
  ],
  outputs: { b2: { node: 2, side: 'solid' } }, nextId: 3,
  drawing: { sheet: 'A3', projection: 'third', hidden: false, scale: 1, scope: { kind: 'part' },
    title: 'Blind thread visibility', views: ['front', 'top'], dimensions: [reference] },
};
const fixture = join(output, 'blind-thread.bcad');
await writeFile(fixture, JSON.stringify(seed), { flag: 'wx' });

const f = await createFlow({
  name: 'drawing-thread-visibility', envFrozen: 'D700_SOURCE_FROZEN', output,
  qualification: 'One authored blind thread in actual native Worker projection, desktop Drawing, history, fresh Open and real SVG/DXF 2000.',
  initialFiles: [import.meta.filename, oracle, fixture], oracleSource: await readFile(oracle, 'utf8'),
  extraFrozen: ['packages/barocss-cad-model/src/drawing/threads.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts',
    'packages/barocss-cad-model/src/io/svg.ts', 'packages/barocss-cad-model/src/io/dxf.ts'],
  limits: ['Local bytes captured before browser file delivery. No live catalog or new tapped feature admission.'],
});

function observeDrawingWorker() {
  const proto = Worker.prototype, descriptor = Object.getOwnPropertyDescriptor(proto, 'onmessage'), post = proto.postMessage;
  if (!descriptor?.set) throw Error('Worker onmessage setter required');
  const requests = new WeakMap();
  window.__threadProjections = [];
  proto.postMessage = function (request, ...args) {
    if (request?.type === 'drawing') {
      if (!requests.has(this)) requests.set(this, new Map());
      requests.get(this).set(request.id, request.options?.orientation ?? 'y-');
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(proto, 'onmessage', {
    configurable: true, get: descriptor.get,
    set(callback) {
      descriptor.set.call(this, callback && function (event) {
        const { id, drawing } = event.data ?? {}, orientation = requests.get(this)?.get(id);
        if (orientation && drawing) {
          requests.get(this).delete(id);
          const rims = drawing.views?.front.edges.filter(edge => edge.circle && edge.name.includes('n2.side'))
            .map(({ name, circle, pieces }) => ({ name, circle, visibility: pieces.map(piece => piece.visible) }));
          window.__threadProjections.push({ orientation, rims });
        }
        callback.call(this, event);
      });
    },
  });
}

const start = f.start;
f.start = async () => {
  await start();
  const newContext = f.browser.newContext.bind(f.browser);
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
      return route.abort();
    });
    await context.addInitScript(observeDrawingWorker);
    await context.addInitScript(() => {
      const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click, blobs = new Map();
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob instanceof Blob) blobs.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = blobs.get(this.href), name = this.download;
        if (!blob || !/\.(bcad|svg|dxf)$/.test(name)) return click.call(this);
        window.__threadFile = blob.arrayBuffer().then(bytes => ({ name, bytes: [...new Uint8Array(bytes)] }));
        blobs.delete(this.href);
      };
    });
    return context;
  };
};

const button = name => f.page.getByRole('button', { name, exact: true });
const hiddenLines = () => f.page.getByLabel('Hidden lines', { exact: true });
const frontSide = () => f.page.getByLabel('Front view side', { exact: true });
const sheet = 'svg[aria-label="Drawing sheet"]';
const front = () => f.page.locator(`${sheet} g.view[data-view="front"]`);
const timeout = 60000;

async function open(file) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(file);
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 3, null, { timeout });
  await f.ready();
  await button('Drawing').click();
  await front().waitFor({ timeout });
}
async function toggle(hidden) {
  const before = await f.doc();
  await hiddenLines().setChecked(hidden);
  await f.changed(before);
  assert.deepEqual(await f.doc(), { ...before, drawing: { ...before.drawing, hidden } });
}
async function capture(command, label) {
  await f.page.evaluate(() => { window.__threadFile = null; });
  await button(command).click();
  await f.page.waitForFunction(() => !!window.__threadFile, null, { timeout });
  const { name, bytes } = await f.page.evaluate(() => window.__threadFile);
  const file = join(output, label + '-' + name), buffer = Buffer.from(bytes);
  await writeFile(file, buffer, { flag: 'wx' });
  f.report.files.push({ label, name, sha256: sha256(buffer) });
  return { file, buffer };
}
async function save(label) {
  const { file, buffer } = await capture('Save', label);
  const doc = await f.doc();
  assert.deepEqual(JSON.parse(buffer), doc);
  return { file, doc };
}
async function check(label, hidden, visible = false, depth = 5, exportFiles = true) {
  f.phase = label;
  await front().waitFor({ timeout });
  const orientation = visible ? 'y+' : 'y-', callout = `M6×1 × ${depth} DEEP`;
  const doc = await f.doc();
  assert.equal(await hiddenLines().isChecked(), hidden);
  assert.equal(await frontSide().inputValue(), orientation);
  const expectedDimension = { ...reference, place: [visible ? -22 : 22, 15], ...(depth === 5 ? {} : { sig: openingSignature }) };
  assert.deepEqual(doc.drawing.dimensions, [expectedDimension]);
  assert.deepEqual(doc.nodes, seed.nodes.map(node => node.kind === 'hole' ? { ...node, depth } : node));
  assert.deepEqual(doc.outputs, seed.outputs);
  assert.deepEqual(doc.parameters, seed.parameters);
  await f.page.waitForFunction(text => window.__studioDrawing?.()?.dimensions[0]?.text === text, callout, { timeout });
  const { dimensions, scale } = await f.page.evaluate(() => window.__studioDrawing());
  assert.equal(scale, 1);
  assert.equal(dimensions.length, 1);
  assert.equal(dimensions[0].id, 'tap');
  assert.ok(Math.abs(dimensions[0].value - 5) < 1e-8);
  const projection = await f.page.evaluate(() => window.__threadProjections.at(-1));
  assert.equal(projection.orientation, orientation);
  const { rims } = projection;
  assert.equal(rims.length, 4);
  for (const { name, circle, visibility } of rims) {
    const opening = name.startsWith('n1.side2|');
    const expected = [10, opening ? 32 : 32 - depth, 4];
    assert.ok(circle.center.every((value, i) => Math.abs(value - expected[i]) < 1e-8));
    assert.ok(Math.abs(circle.radius - 2.5) < 1e-8);
    assert.deepEqual(visibility, visible ? (opening ? [true] : []) : [false]);
  }
  const matches = await front().locator('path[d*="A3 3 "]').evaluateAll(paths =>
    paths.map(path => ({ path: path.getAttribute('d'), dash: path.getAttribute('stroke-dasharray') })));
  const pen = mode === '--baseline' || visible ? 'thin' : hidden ? 'hidden' : 'none';
  const rimCount = visible ? 2 : hidden ? 4 : 0;
  f.report.observations.push({ label, hidden, visible, depth, rims, dimension: dimensions[0], cosmetics: matches });
  await f.persist();
  assert.equal(matches.length, Number(pen !== 'none'));
  assert.ok(matches.every(mark => mark.dash === (pen === 'hidden' ? '3 1.5' : null)));
  assert.equal(await front().locator('path[d*="A2.5 2.5 "]').count(), rimCount);
  assert.equal(await front().locator('line[stroke-dasharray="8 1.5 1.5 1.5"]').count(), 2);
  if (exportFiles) {
    const svg = await capture('Export SVG', label), dxf = await capture('Export DXF', label);
    await f.runOracle({ visible, pen, depth, rims: rimCount, svg: svg.file, dxf: dxf.file }, label);
  }
}

await f.run(async () => {
  f.phase = 'Open authored blind thread';
  await open(fixture);
  const initial = await f.doc();
  await check('occluded-off', false);
  await f.snapshot('occluded-off');
  await toggle(true);
  const shown = await f.doc();
  await check('occluded-on', true);
  await f.snapshot('occluded-on');
  if (mode === '--baseline') assert.fail('Original Studio and both exporters retain a thin cosmetic arc with every native rim hidden, even with Hidden lines off');

  await f.undo();
  await f.same(initial);
  await check('first-undo', false, false, 5, false);
  await f.redo();
  await f.same(shown);
  await check('first-redo', true, false, 5, false);

  const savedOn = await save('saved-on');
  await open(savedOn.file);
  await f.same(savedOn.doc);
  await check('fresh-on', true);
  await toggle(false);
  const savedOff = await save('saved-off');
  await open(savedOff.file);
  await f.same(savedOff.doc);
  await check('fresh-off', false);

  await frontSide().selectOption('y+');
  await f.changed(savedOff.doc);
  await check('visible-off', false, true);
  await f.snapshot('visible-off');
  await toggle(true);
  await check('visible-on', true, true);
  const beforeTurn = await f.doc();
  await frontSide().selectOption('y-');
  await f.changed(beforeTurn);
  await check('returned-to-hidden', true, false, 5, false);

  await button('Model').click();
  const beforeEdit = await f.doc();
  await f.openFeatureEditor(2, 'blind hole');
  await f.editor().getByLabel('Depth', { exact: true }).fill('6');
  await f.applyEditor(beforeEdit, 'blind-depth-6');
  assert.deepEqual((await f.doc()).drawing, { ...beforeEdit.drawing, dimensions: [{ ...reference, sig: openingSignature }] });
  await button('Drawing').click();
  await check('edited-on', true, false, 6);
  await toggle(false);
  await check('edited-off', false, false, 6);
  assert.deepEqual(f.report.downloads, []);
});
