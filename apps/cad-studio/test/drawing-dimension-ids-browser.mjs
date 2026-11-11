// D754: allocate IDs across a drawing set for actual manual and automatic dimensions.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const fixturePath = 'packages/barocss-cad/conformance/r14/orient-cross-hole-y-plus/case.json';
const { input } = JSON.parse(await readFile(fixturePath, 'utf8'));
const fixture = { ...input.document, drawing: {
  sheet: 'A4', projection: 'third', hidden: true, title: 'Dimension IDs in a drawing set',
  views: ['front', 'top', 'right', 'iso'], dimensions: [],
  sheets: [{ id: 'S2', name: 'Continuation', size: 'A3', scale: 1, views: ['right'] }],
} };
const pins = [
  'apps/cad-studio/test/drawing-dimension-ids-browser.mjs', 'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
  'packages/barocss-cad-model/src/drawing/auto.ts', 'packages/barocss-cad-model/src/drawing/sheets.ts', fixturePath,
];
const f = await createFlow({
  name: 'drawing-dimension-ids', output, envFrozen: 'D754_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce duplicate IDs across two sheets' : 'Keep drawing-wide dimension identities unique',
  limits: ['Two ordinary desktop sheets with an X-axis through-hole. SVG bytes intercepted locally before delivery.'],
  snapshotExtra: () => ({
    dimensions: window.__studioDrawing?.()?.dimensions ?? [],
    activeSheet: document.querySelector('[role="tablist"][aria-label="Sheets"] [aria-selected="true"]')?.textContent ?? null,
  }),
  oracleSource: String.raw`
import json, sys, xml.etree.ElementTree as ET
sheets = json.load(sys.stdin)["sheets"]
ns = {"s": "http://www.w3.org/2000/svg"}
seen = set()
for i, text in enumerate(sheets):
    root = ET.fromstring(text)
    assert root.attrib["width"] == ["297mm", "420mm"][i], root.attrib
    dims = root.findall(".//s:g[@class='dimension'][@data-dim]", ns)
    labels = sorted("".join(group.itertext()).strip() for group in dims)
    assert labels == [["30", "30", "60"], ["15", "15", "Ø8 THRU"]][i], labels
    ids = {group.attrib["data-dim"] for group in dims}
    assert len(ids) == len(dims) and seen.isdisjoint(ids), (seen, ids)
    seen.update(ids)
print(json.dumps({"status": "PASS", "uniqueDimensions": len(seen)}))
`,
});

function captureSvg() {
  const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click, blobs = new Map();
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    if (blob.type === 'image/svg+xml') blobs.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = blobs.get(this.href);
    if (!blob || !this.download.endsWith('.svg')) return click.call(this);
    window.__d754Svg = blob.text().then(text => ({ name: this.download, text }));
    blobs.delete(this.href);
  };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.addInitScript(captureSvg);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  const page = f.page, button = name => page.getByRole('button', { name, exact: true });
  const modeButton = name => page.locator('.mode').getByRole('button', { name, exact: true });
  const tab = name => page.getByRole('tab', { name, exact: true });
  const select = async name => {
    await tab(name).click();
    assert.equal(await tab(name).getAttribute('aria-selected'), 'true');
    await page.locator('svg[aria-label="Drawing sheet"]').waitFor();
  };
  const autos = async (previous, label) => {
    await button('Auto-dimension').click();
    await f.changed(previous);
    await f.waitToast(/\d+ dimensions? placed/);
    const state = await f.snapshot(label);
    await f.dismissToasts();
    return state;
  };
  const svg = async label => {
    await page.evaluate(() => { window.__d754Svg = null; });
    await button('Export SVG').click();
    await page.waitForFunction(() => window.__d754Svg);
    const { name, text } = await page.evaluate(() => window.__d754Svg);
    f.report.files.push({ label, name, sha256: sha256(text) });
    return text;
  };
  const clickRight = async (u, v) => {
    const pixel = await page.evaluate(([u, v]) => window.__studioDrawingAt('right', u, v), [u, v]);
    assert.ok(Number.isFinite(pixel?.x) && Number.isFinite(pixel?.y));
    await page.mouse.move(pixel.x - 3, pixel.y);
    await page.mouse.move(pixel.x, pixel.y);
    await page.mouse.click(pixel.x, pixel.y);
  };
  const dimensions = state => state.doc.drawing.dimensions;
  const duplicates = dims => dims.filter((d, i) => dims.findIndex(x => x.id === d.id) < i).map(d => d.id);

  f.phase = 'Auto-dimension sheet 1 and leave the continuation blank';
  const file = 'sheet-dimension-ids.bcad', bytes = Buffer.from(JSON.stringify(fixture));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
  await page.waitForFunction(() => window.__studioDoc?.drawing?.title === 'Dimension IDs in a drawing set');
  await f.ready();
  const source = await f.doc();
  f.report.observations.push({ sourceSHA256: sha256(bytes) });
  await modeButton('Drawing').click();
  await select('Sheet 1');
  const first = await autos(source, 'first-sheet-auto');
  assert.deepEqual(dimensions(first).map(d => d.id).sort(), ['d1', 'd2', 'd3']);
  assert.deepEqual(first.dimensions.map(d => d.value).sort((a, b) => a - b), [30, 30, 60]);

  f.phase = 'Place a real manual diameter on the continuation';
  await select('Continuation');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('o');
  await clickRight(19, 15);
  await clickRight(35, 30);
  await f.changed(first.doc);
  const manual = await f.snapshot('continuation-manual-diameter');
  const diameter = dimensions(manual).find(d => d.view === 'right');
  assert.ok(diameter && diameter.kind === 'diameter');
  assert.equal(diameter.id, baseline ? 'd1' : 'd4');
  assert.deepEqual(duplicates(dimensions(manual)), baseline ? ['d1'] : []);
  assert.equal(manual.dimensions[0].text, 'Ø8 THRU');
  await button('Undo').click();
  await f.same(first.doc);

  f.phase = 'Auto-dimension the continuation after the first sheet';
  const auto = await autos(first.doc, 'continuation-auto');
  assert.deepEqual(auto.dimensions.map(d => d.text).sort(), ['15', '15', 'Ø8 THRU']);
  assert.deepEqual(duplicates(dimensions(auto)), baseline ? ['d1', 'd2', 'd3'] : []);
  assert.deepEqual(dimensions(auto).filter(d => d.view !== 'right'), dimensions(first));
  if (baseline) return;
  assert.deepEqual(dimensions(auto).filter(d => d.view === 'right').map(d => d.id).sort(), ['d4', 'd5', 'd6']);
  const secondSvg = await svg('second-sheet');
  await select('Sheet 1');
  const firstSvg = await svg('first-sheet');
  await f.runOracle({ sheets: [firstSvg, secondSvg] }, 'unique-svg-ids');
  await button('Undo').click();
  await f.same(first.doc);
  await button('Redo').click();
  await f.same(auto.doc);

  f.phase = 'Read both ID sets after local project Save and fresh Open';
  const project = 'D754 dimension IDs';
  const panel = () => page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const attach = async () => {
    if (!(await panel().isVisible())) await button('Project and versions').click();
    await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await panel().getByLabel('Project', { exact: true }).waitFor();
  };
  await modeButton('Model').click();
  await attach();
  await button('Save').click();
  await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await page.evaluate(async ([project, file]) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, [project, file]);
  assert.deepEqual(JSON.parse(saved), auto.doc);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await panel().getByRole('button', { name: 'Close project', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await panel().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(auto.doc);
  await modeButton('Drawing').click();
  await select('Continuation');
  const opened = await f.snapshot('fresh-open-continuation-ids');
  assert.deepEqual(opened.dimensions.map(d => d.id).sort(), ['d4', 'd5', 'd6']);
  assert.deepEqual(f.report.downloads, []);
});
