// Desktop acceptance for #2406. Run under the heavy gate with D697_SOURCE_FROZEN=1.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const output = process.argv[2], repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
await mkdir(output, { recursive: true });
const seedFile = join(import.meta.dirname, 'fixtures/bracket.bcad');
const seed = JSON.parse(await readFile(seedFile));
const savedScale = process.argv.includes('--saved-scale');
const sourceWidth = savedScale ? 40 : 9000;
const wide = structuredClone(seed);
wide.nodes[0].max = [sourceWidth, 100];
wide.nodes[1].height = 10;
const point = x => ({ edge: 'n1.bottom|n1.side0', at: 'end', near: [x, 0, 0] });
const width = { id: 'width', view: 'front', kind: 'linear', a: point(0), b: point(sourceWidth), orient: 'horizontal', place: [20, -10], tol: { kind: 'symmetric', value: 0.05 } };
wide.drawing = {
  sheet: savedScale ? 'A3' : 'A4', ...(savedScale ? { scale: 0.005 } : {}), projection: 'third', hidden: true, views: ['front', 'top'],
  title: 'Layout refusal witness', dimensions: [width, { ...width, id: 'earlier-auto', auto: true, tol: undefined, place: [20, -14] }],
  notes: [{ id: 'note', text: 'Existing drawing note', at: [20, 40] }],
  ...(!savedScale ? { sections: ['A', 'B', 'C', 'D', 'E'].map((id, k) => ({ id, view: 'front', at: 10 * (k + 1) })) } : {}),
};
const wideFile = join(output, 'wide.bcad');
await writeFile(wideFile, JSON.stringify(wide), { flag: 'wx' });

const f = await createFlow({
  name: 'auto-layout-no-fit', envFrozen: 'D697_SOURCE_FROZEN', output,
  qualification: 'Desktop Auto-layout no-fit refusal, history and drawing artifact retention.',
  oracleSource: `
import json
import sys
import xml.etree.ElementTree as ET

request = json.load(sys.stdin)
ns = {"svg": "http://www.w3.org/2000/svg"}
root = ET.parse(request["svg"]).getroot()
assert root.get("width") == request["sheetWidth"], root.attrib
for dim_id in ("width", "earlier-auto"):
    groups = root.findall(".//svg:g[@data-dim='" + dim_id + "']", ns)
    assert len(groups) == 1, (dim_id, len(groups))
    label = " ".join(groups[0].itertext()).strip()
    expected = str(request["sourceWidth"]) + (" ±0.05" if dim_id == "width" else "")
    assert label == expected, (dim_id, label, expected)
assert any(t.text == "Existing drawing note" for t in root.findall(".//svg:text", ns))
print(json.dumps({"status": "PASS", "sheetWidth": root.get("width"), "sourceWidth": request["sourceWidth"]}))
`,
  initialFiles: [import.meta.filename, seedFile, wideFile],
  extraFrozen: ['packages/barocss-cad-model/src/drawing/layout.ts', 'packages/barocss-cad-model/src/drawing/issues.ts'],
  limits: ['Standalone fixture through the actual Studio consumer. Local emitted bytes captured before browser file delivery.'],
});

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
    await context.addInitScript(() => {
      const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click, blobs = new Map();
      window.__d697File = null;
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob instanceof Blob) blobs.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = blobs.get(this.href), name = this.download;
        if (!blob || !/\.(bcad|svg)$/.test(name)) return click.call(this);
        window.__d697File = blob.arrayBuffer().then(bytes => ({ name, bytes: [...new Uint8Array(bytes)] }));
        blobs.delete(this.href);
      };
    });
    return context;
  };
};
const button = name => f.page.getByRole('button', { name, exact: true });
const timeout = 60000;

async function openDrawing(file) {
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(file);
  await f.page.waitForFunction(() => window.__studioDoc?.nodes?.length === 2, null, { timeout });
  await f.ready();
  await button('Drawing').click();
  await f.page.waitForFunction(expected => {
    const sheet = window.__studioDrawing?.();
    return sheet && sheet.sections.length === expected;
  }, savedScale ? 0 : 5, { timeout });
}
async function capture(command, label) {
  await f.page.evaluate(() => { window.__d697File = null; });
  await button(command).click();
  await f.page.waitForFunction(() => !!window.__d697File, null, { timeout });
  const { name, bytes } = await f.page.evaluate(() => window.__d697File);
  const file = join(output, label + '-' + name), buffer = Buffer.from(bytes);
  await writeFile(file, buffer, { flag: 'wx' });
  f.report.files.push({ label, name, sha256: sha256(buffer) });
  return { file, buffer };
}
const history = async () => ({
  undo: await button('Undo').isEnabled(), redo: await button('Redo').isEnabled(),
  rows: await f.page.locator('.history .hs').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label'))),
});
const drawing = () => f.page.evaluate(() => window.__studioDrawing());
async function clickAuto(expected) {
  await f.dismissToasts();
  await button('Auto-dimension').click();
  const alert = f.page.locator('.toast[role="alert"]');
  // An unhandled exception must fail the original-source run at the first actual click.
  await f.page.waitForFunction(() => !!document.querySelector('.toast[role="alert"]') || window.__d697Error, null, { timeout });
  assert.deepEqual(f.report.errors, []);
  assert.match(await alert.innerText(), expected);
}

await f.run(async () => {
  await f.newPage();
  await f.page.evaluate(() => addEventListener('unhandledrejection', () => { window.__d697Error = true; }));
  f.phase = 'Open and project the source';
  await openDrawing(wideFile);
  const initial = await drawing();
  f.report.observations.push({ sourceWidth, savedScale, initial });
  await f.persist();
  assert.equal((await f.doc()).nodes[0].max[0], sourceWidth);
  assert.deepEqual(initial.dimensions.map(d => d.value), [sourceWidth, sourceWidth]);
  if (savedScale) {
    assert.equal(initial.scale, 0.005);
  } else {
    assert.equal(initial.scale, 0.01);
    assert.ok(Math.abs(initial.boxes.front[2] - initial.boxes.front[0] - 90) < 1e-9);
    assert.equal(initial.placedSections.length, 5);
    assert.ok(initial.placedSections.every(s => Math.abs(s.box[2] - s.box[0] - 90) < 1e-9));
    assert.ok(5 * sourceWidth * 0.01 > 420);
    assert.ok(initial.issues.some(i => i.code === 'VIEWS_DONT_FIT'));
  }
  const expected = savedScale ? /A3.*no supported scale.*1:200/i : /A4.*1:100.*A3.*1:100/s;
  // Keep one accepted edit and one redo entry while testing refusal.
  await f.page.getByLabel('Hidden lines', { exact: true }).uncheck();
  await f.page.getByLabel('Centre lines', { exact: true }).uncheck();
  const expectedRedo = await f.doc();
  assert.equal(expectedRedo.drawing.centers, false);
  await f.undo();
  const original = await f.doc(), originalHistory = await history();
  assert.equal(original.drawing.hidden, false);
  assert.equal(originalHistory.undo, true);
  assert.equal(originalHistory.redo, true);
  const before = await capture('Export SVG', 'before');

  f.phase = 'Auto refuses a drawing with no fitting candidate';
  await clickAuto(expected);
  await f.same(original);
  assert.deepEqual(await history(), originalHistory);
  assert.equal((await drawing()).issues.find(i => i.code === 'VIEWS_DONT_FIT')?.fix, undefined);
  await f.snapshot('first-refusal');

  f.phase = 'Repeated Auto and unchanged output';
  await clickAuto(expected);
  await f.same(original);
  assert.deepEqual(await history(), originalHistory);
  const after = await capture('Export SVG', 'after');
  assert.deepEqual(after.buffer, before.buffer);
  await f.runOracle({ svg: after.file, sheetWidth: savedScale ? '420mm' : '297mm', sourceWidth }, 'independent-svg');
  await f.redo();
  await f.same(expectedRedo);
  await f.undo();
  await f.same(original);
  const saved = await capture('Save', 'saved');
  assert.deepEqual(JSON.parse(saved.buffer), original);

  f.phase = 'Fresh Open and edit to recover';
  await f.newPage();
  await openDrawing(saved.file);
  assert.deepEqual(await f.doc(), original);
  if (savedScale) {
    await f.page.getByLabel('Scale', { exact: true }).selectOption('auto');
    await f.page.waitForFunction(() => window.__studioDoc?.drawing?.scale === undefined, null, { timeout });
  } else {
    await button('Model').click();
    await f.page.locator('.history .hs[data-node-index="1"]').click();
    const input = f.editor().getByLabel('Width', { exact: true });
    assert.equal(await input.inputValue(), String(sourceWidth));
    await input.fill('40');
    await f.editor().getByRole('button', { name: 'Apply', exact: true }).click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes[0].max[0] === 40, null, { timeout });
    await f.ready();
    await button('Drawing').click();
    await f.page.waitForFunction(() => window.__studioDrawing?.()?.dimensions.some(d => d.id === 'width' && d.value === 40), null, { timeout });
  }
  await clickAuto(/dimensions? placed/);
  assert.ok(!(await drawing()).issues.some(i => i.code === 'VIEWS_DONT_FIT'));
  assert.ok((await f.doc()).drawing.dimensions.some(d => d.id === 'width' && d.tol?.value === 0.05));
  await f.snapshot('recovered');
  assert.deepEqual(f.report.downloads, []);
});
