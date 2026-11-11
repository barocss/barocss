// D699 desktop evidence. Run under the heavy gate with D699_SOURCE_FROZEN=1.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--baseline', '--fixed'].includes(mode));
await mkdir(output, { recursive: true });
const seedFile = join(import.meta.dirname, 'fixtures/bracket.bcad');
const seed = JSON.parse(await readFile(seedFile));
const half = 1 / 128, fixtures = new Map();
for (const [offset, label] of [[0, 'origin'], [8192, 'plus'], [-8192, 'minus']]) {
  const doc = structuredClone(seed);
  doc.nodes[0].max = [10, 1 / 64];
  doc.nodes[1].height = 10;
  doc.nodes.push({ id: 'n2', kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [0, offset, 0] });
  doc.outputs = { b2: { node: 2, side: 'solid' } };
  doc.nextId = 3;
  const end = x => ({ edge: 'n1.side0|n1.top', at: 'end', near: [x, offset, 10] });
  doc.drawing = {
    sheet: 'A3', projection: 'third', hidden: true, scale: 1, scope: { kind: 'part' },
    title: 'Translated section witness', views: ['front', 'top'],
    section: { y: offset + 1 / 32 },
    dimensions: [{ id: 'width', view: 'front', kind: 'linear', a: end(0), b: end(10), orient: 'horizontal', place: [5, 13] }],
  };
  const file = join(output, label + '.bcad');
  await writeFile(file, JSON.stringify(doc), { flag: 'wx' });
  fixtures.set(offset, { file, label, doc });
}
const oracle = `
import json
import math
import sys
import xml.etree.ElementTree as ET

r = json.load(sys.stdin)
ns = {"svg": "http://www.w3.org/2000/svg"}
root = ET.parse(r["svg"]).getroot()
groups = [g for g in root.findall(".//svg:g[@data-dim='A'][@class='section']", ns) if "data-view" not in g.attrib]
labels = [t for t in root.findall(".//svg:text", ns) if t.text == "SECTION A–A"]
assert len(groups) == int(r["crossing"]) and len(labels) == int(r["crossing"])
if groups:
    def points(e):
        return ((float(e.get("x1")), float(e.get("y1"))), (float(e.get("x2")), float(e.get("y2"))))
    outline = [points(e) for e in groups[0].findall("svg:line[@stroke-width='0.5']", ns)]
    coordinates = {p for e in outline for p in e}
    x0, y0 = map(min, zip(*coordinates))
    corners = [(0, 0), (10, 0), (10, 10), (0, 10)]
    assert {(round(x - x0, 8), round(y - y0, 8)) for x, y in coordinates} == set(corners)
    boundary = {frozenset((corners[k], corners[(k + 1) % 4])) for k in range(4)}
    assert len(outline) == 4
    assert {frozenset((round(x - x0, 8), round(y - y0, 8)) for x, y in e) for e in outline} == boundary
    hatch = [points(e) for e in groups[0].findall("svg:line[@stroke-width='0.25']", ns)]
    assert hatch and all(x0 - 1e-4 <= x <= x0 + 10 + 1e-4 and y0 - 1e-4 <= y <= y0 + 10 + 1e-4 for e in hatch for x, y in e)
    assert all(math.isclose(abs(b[0] - a[0]), abs(b[1] - a[1]), abs_tol=2e-4) for a, b in hatch)
dim, = root.findall(".//svg:g[@data-dim='width'][@class='dimension']", ns)
assert any(t.text == "10" for t in dim.findall("svg:text", ns))
print(json.dumps({"status": "PASS", "crossing": r["crossing"], "boundaryMM": [10, 10] if groups else None,
                  "areaMM2": 100 if groups else 0, "hatchLines": len(hatch) if groups else 0}))
`;

const f = await createFlow({
  name: 'section-translation', envFrozen: 'D699_SOURCE_FROZEN', output, oracleSource: oracle,
  qualification: 'Drawing Worker sections across exact dyadic translations, history, native save/reopen and actual SVG.',
  initialFiles: [import.meta.filename, seedFile, ...[...fixtures.values()].map(fixture => fixture.file)],
  extraFrozen: ['packages/barocss-cad-model/src/drawing/section.ts', 'packages/barocss-cad-model/src/drawing/sheet.ts',
    'packages/barocss-cad-model/src/engine/part.ts', 'packages/barocss-cad/src/numeric-policy.ts'],
  limits: ['Actual local SVG and native file bytes captured before browser-managed delivery.'],
});

// Observe actual drawing replies and hold one original reply for the document replacement case.
function installDrawingWitness() {
  const proto = Worker.prototype, handler = Object.getOwnPropertyDescriptor(proto, 'onmessage'), post = proto.postMessage;
  if (!handler?.set) throw Error('Worker onmessage setter required');
  const requests = new WeakMap(), records = [];
  let armedDepth, held, forward;
  proto.postMessage = function (request, ...args) {
    if (request?.type === 'drawing') {
      if (!requests.has(this)) requests.set(this, new Map());
      requests.get(this).set(request.id, request.options?.sections?.find(section => section.id === 'A')?.at);
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(proto, 'onmessage', {
    configurable: true, get: handler.get,
    set(callback) {
      handler.set.call(this, callback && function (event) {
        const id = event.data?.id, drawing = event.data?.drawing;
        if (drawing && requests.get(this)?.has(id)) {
          const at = requests.get(this).get(id);
          requests.get(this).delete(id);
          const result = drawing.sections?.find(section => section.id === 'A')?.result;
          const record = { id, at, result };
          records.push(record);
          if (armedDepth !== undefined && at === armedDepth) {
            armedDepth = undefined;
            held = record;
            forward = () => callback.call(this, event);
            return;
          }
        }
        callback.call(this, event);
      });
    },
  });
  window.__d699Drawing = {
    arm(at) { if (armedDepth !== undefined || held) throw Error('One drawing hold per context'); armedDepth = at; },
    release() { if (!forward) throw Error('No native reply held'); forward(); forward = undefined; },
    snapshot: () => ({ records, held, pending: !!forward }),
  };
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
    await context.addInitScript(installDrawingWitness);
    await context.addInitScript(() => {
      const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click, blobs = new Map();
      window.__d699File = null;
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob instanceof Blob) blobs.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = blobs.get(this.href), name = this.download;
        if (!blob || !/\.(bcad|svg)$/.test(name)) return click.call(this);
        window.__d699File = blob.arrayBuffer().then(bytes => ({ name, bytes: [...new Uint8Array(bytes)] }));
        blobs.delete(this.href);
      };
    });
    return context;
  };
};

const button = name => f.page.getByRole('button', { name, exact: true });
const timeout = 60000;
const sheet = () => f.page.locator('svg[aria-label="Drawing sheet"]');
async function open(file, offset, depth, fresh = true) {
  if (fresh) await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(file);
  await f.page.waitForFunction(([y, at]) => window.__studioDoc?.nodes?.[2]?.offset?.[1] === y && window.__studioDoc?.drawing?.section?.y === at, [offset, depth], { timeout });
  await f.ready();
  if (!(await sheet().count())) await button('Drawing').click();
  await currentSection(depth);
}
async function currentSection(depth) {
  await f.page.waitForFunction(at => window.__studioDrawing?.()?.sections.some(section => section.id === 'A' && section.at === at), depth, { timeout });
  return f.page.evaluate(at => window.__studioDrawing().sections.find(section => section.id === 'A' && section.at === at), depth);
}
async function setDepth(depth) {
  const input = f.page.getByLabel('Section Y', { exact: true });
  await input.fill(String(depth));
  await input.press('Enter');
  await f.page.waitForFunction(at => window.__studioDoc?.drawing?.section?.y === at, depth, { timeout });
}
async function capture(command, label) {
  await f.page.evaluate(() => { window.__d699File = null; });
  await button(command).click();
  await f.page.waitForFunction(() => !!window.__d699File, null, { timeout });
  const { name, bytes } = await f.page.evaluate(() => window.__d699File);
  const file = join(output, label + '-' + name), buffer = Buffer.from(bytes);
  await writeFile(file, buffer, { flag: 'wx' });
  f.report.files.push({ label, name, sha256: sha256(buffer) });
  return { file, buffer };
}
async function observe(label, depth, crossing, exportSvg = false) {
  f.phase = label;
  const consumer = await currentSection(depth);
  const worker = await f.page.evaluate(at => window.__d699Drawing.snapshot().records.filter(r => r.at === at).at(-1), depth);
  const doc = await f.doc();
  f.report.observations.push({ label, consumer, worker, depth, doc });
  await f.persist();
  assert.equal(worker?.result?.ok, crossing);
  assert.equal(doc.drawing.section.y, depth);
  const width = await f.page.evaluate(() => window.__studioDrawing().dimensions.find(d => d.id === 'width'));
  assert.equal(width?.value, 10);
  assert.equal(await sheet().locator('g.section[data-dim="A"]:not([data-view])').count(), Number(crossing));
  if (crossing) {
    assert.equal(consumer.rings, 1);
    assert.deepEqual(worker.result.ringBodies, [0]);
    const [ring] = worker.result.rings;
    assert.equal(ring.length, 5);
    assert.deepEqual(ring.at(-1), ring[0]);
    assert.deepEqual(ring.slice(0, -1).map(p => p.join(',')).sort(), ['0,0', '0,10', '10,0', '10,10']);
  } else {
    assert.match(consumer.error, /Nothing of the part lies behind Y = /);
    await f.page.getByText(/^Section A–A: Nothing of the part lies behind Y = /).waitFor();
  }
  if (exportSvg) {
    const { file } = await capture('Export SVG', label);
    await f.runOracle({ svg: file, crossing }, label);
  }
  return doc;
}

await f.run(async () => {
  for (const [offset, fixture] of fixtures) {
    const miss = offset + 1 / 32, cut = offset + half;
    f.phase = fixture.label + '-open';
    await open(fixture.file, offset, miss);
    const before = await observe(fixture.label + '-true-miss', miss, false, offset === 0);
    await setDepth(cut);
    const crossing = mode === '--fixed' || offset === 0;
    const after = await observe(fixture.label + '-mid-cut', cut, crossing, true);
    assert.deepEqual(after, { ...before, drawing: { ...before.drawing, section: { y: cut } } });
    await f.snapshot(fixture.label + '-mid-cut');

    if (mode === '--fixed' && offset === 8192) {
      await f.undo();
      await f.same(before);
      await observe('first-undo', miss, false);
      await f.redo();
      await f.same(after);
      await observe('first-redo', cut, true);
      const saved = await capture('Save', 'translated');
      assert.deepEqual(JSON.parse(saved.buffer), after);
      await open(saved.file, offset, cut);
      await f.same(after);
      await observe('fresh-open', cut, true, true);
    }
  }
  if (mode === '--baseline') assert.fail('The original drawing Worker omitted both crossing translated boxes');

  f.phase = 'Hold a native success across replacement Open';
  const oldCut = -8192 + 3 / 256;
  await f.page.evaluate(at => window.__d699Drawing.arm(at), oldCut);
  await setDepth(oldCut);
  await f.page.waitForFunction(() => !!window.__d699Drawing.snapshot().held, null, { timeout });
  const held = await f.page.evaluate(() => window.__d699Drawing.snapshot().held);
  assert.equal(held.at, oldCut);
  assert.equal(held.result.ok, true);
  assert.equal(held.result.rings.length, 1);
  f.report.heldDrawing = held;
  const replacement = fixtures.get(8192), miss = 8192 + 1 / 32;
  await open(replacement.file, 8192, miss, false);
  const accepted = await observe('replacement-miss-before-release', miss, false);
  await f.page.evaluate(async () => {
    window.__d699Drawing.release();
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  const final = await observe('replacement-miss-after-release', miss, false, true);
  assert.deepEqual(final, accepted);
  assert.equal(await f.page.evaluate(() => window.__d699Drawing.snapshot().pending), false);
  assert.deepEqual(f.report.downloads, []);
});
