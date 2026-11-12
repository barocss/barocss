// D763/B05-07: current assembly projection and issued revision through native reopen.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/static-assembly-drawing-revision-browser.mjs',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'apps/cad-studio/src/ui/drawing/SheetSettings.tsx',
  'apps/cad-studio/src/ui/drawing/revisionPrint.ts', 'apps/cad-studio/src/ui/useDrawingSheet.ts',
  'packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/io/svg.ts',
];

const f = await createFlow({
  name: 'static-assembly-drawing-revision', envFrozen: 'D763_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'B05-07 assembly projection, stale issue and native project reopen',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['Two translated rectangular parts, one front direction and SVG output. No PDF or drawing standard certification.'],
  inspectorSource: String.raw`
import { emptyDoc, rectanglePart } from '@barocss/cad-model/engine/doc';
const doc = rectanglePart(30, 12, 6);
const part = { id: 'box', rev: 'A' };
const instance = (id, name, x) => ({ id, name, doc, part, position: [x, 0, 0], rotation: [0, 0, 0] });
console.log(JSON.stringify({ ...emptyDoc(), instances: [instance('first','First box',0), instance('second','Second box',40)] }));
`,
  oracleSource: String.raw`
import json, re, sys, xml.etree.ElementTree as ET
x = json.load(sys.stdin)
root = ET.fromstring(x["svg"])
ns = {"s":"http://www.w3.org/2000/svg"}
front, = root.findall(".//s:g[@class='view'][@data-view='front']",ns)
lines = front.findall("s:line",ns)
xs = sorted(set(float(line.attrib[k]) for line in lines for k in ("x1","x2")))
ys = sorted(set(float(line.attrib[k]) for line in lines for k in ("y1","y2")))
want = [0,30,x["second"],x["second"]+30]
assert len(xs)==len(want) and all(abs(v-xs[0]-w)<=0.0001 for v,w in zip(xs,want)), xs
assert len(ys)==2 and abs(ys[1]-ys[0]-6)<=0.0001, ys
title, = root.findall(".//s:g[@class='title']",ns)
labels = title.findall("s:text",ns)
rev, = [label for label in labels if label.text == "REV"]
issue, = [label for label in labels if label.attrib["x"] == rev.attrib["x"] and float(label.attrib["y"]) > float(rev.attrib["y"])]
assert issue.text == x["revision"]
src, = [label.text for label in labels if label.text and label.text.startswith("SRC ")]
assert re.fullmatch(r"SRC [0-9a-f]+",src), src
scale, = [label for label in labels if label.text == "SCALE"]
value, = [label for label in labels if label.attrib["x"] == scale.attrib["x"] and float(label.attrib["y"]) > float(scale.attrib["y"])]
assert value.text == "1:1"
print(json.dumps({"status":"PASS","frontWidth":want[-1],"revision":issue.text,"source":src[4:]}))
`,
  snapshotExtra: () => ({
    scale: window.__studioDrawing?.()?.scale ?? null,
    stale: document.querySelector('[aria-label="Revision out of date"]')?.textContent ?? null,
    instanceBounds: window.__studioInstanceBounds?.() ?? [],
  }),
});

function captureSvg() {
  const urls = new Map(), create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
  const svg = [];
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    if (blob.type === 'image/svg+xml') urls.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = urls.get(this.href);
    if (!blob || !this.download.endsWith('.svg')) return click.call(this);
    svg.push(blob.text());
    urls.delete(this.href);
  };
  window.__d763Svg = svg;
}

await f.run(async () => {
  const doc = await f.inspect('fixture', {});
  const bytes = Buffer.from(JSON.stringify(doc));
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.addInitScript(captureSvg);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  await f.newPage();
  const page = f.page, button = name => page.getByRole('button', { name, exact: true });
  const mode = name => page.locator('.mode').getByRole('button', { name, exact: true }).click();
  const settings = page.getByRole('complementary', { name: 'Drawing settings', exact: true });
  const stale = settings.getByLabel('Revision out of date', { exact: true });
  const binding = async (label, second, revision, outdated) => {
    const exportButton = settings.getByRole('button', { name: 'Export SVG', exact: true });
    await page.waitForFunction(() => window.__studioDrawing?.()?.scale === 1);
    await stale.waitFor({ state: outdated ? 'visible' : 'hidden' });
    const before = await page.evaluate(() => window.__d763Svg.length);
    await exportButton.click();
    const svg = await page.evaluate(() => window.__d763Svg.at(-1));
    assert.equal(await page.evaluate(() => window.__d763Svg.length), before + 1);
    const state = await f.snapshot(label);
    const evidence = await f.runOracle({ svg, second, revision }, label);
    assert.equal(state.doc.instances[1].position[0], second);
    assert.deepEqual(state.doc.drawing.scope, { kind: 'assembly' });
    assert.equal(state.doc.drawing.revision, revision);
    assert.equal(Boolean(state.stale), outdated);
    f.report.files.push({ label, sha256: sha256(svg), kind: 'Studio SVG' });
    return { doc: state.doc, source: evidence.source };
  };

  f.phase = 'Open the native two-part assembly and issue drawing A';
  const file = 'assembly-drawing.bcad';
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
  await page.waitForFunction(() => window.__studioDoc.instances?.[1]?.id === 'second');
  await f.ready();
  f.report.observations.push({ sourceSHA256: sha256(bytes) });
  await mode('Drawing');
  await settings.getByLabel('Drawing scope', { exact: true }).selectOption('assembly');
  await settings.getByLabel('Scale', { exact: true }).selectOption('1');
  await settings.getByRole('button', { name: 'Next revision', exact: true }).click();
  const a = await binding('issue-A-width-70', 40, 'A', false);
  assert.ok(a.doc.drawing.revisedModel);

  const move = async x => {
    await mode('Model');
    await page.locator('.ol.instance').filter({ hasText: 'Second box' }).click();
    const xField = page.getByRole('complementary', { name: 'Instance', exact: true }).getByLabel('Instance X', { exact: true }).first();
    await xField.fill(String(x));
    await xField.press('Enter');
    await page.waitForFunction(x => window.__studioDoc.instances?.[1]?.position[0] === x, x);
    await mode('Drawing');
  };

  f.phase = 'Move one occurrence and verify the retained issue and current projection';
  await move(55);
  const changed = await binding('issue-A-stale-width-85', 55, 'A', true);
  assert.deepEqual(changed.doc.drawing, a.doc.drawing);
  assert.notEqual(changed.source, a.source);
  assert.deepEqual(changed.doc.instances[0], a.doc.instances[0]);
  assert.deepEqual(changed.doc.instances[1].doc, a.doc.instances[1].doc);
  await button('Undo').click();
  await f.same(a.doc);
  assert.equal((await binding('undo-current-A-width-70', 40, 'A', false)).source, a.source);
  await button('Redo').click();
  await f.same(changed.doc);
  assert.equal((await binding('redo-stale-A-width-85', 55, 'A', true)).source, changed.source);

  f.phase = 'Issue B and change only the sheet size';
  await settings.getByRole('button', { name: 'Next revision', exact: true }).click();
  const b = await binding('issue-B-width-85', 55, 'B', false);
  assert.notEqual(b.doc.drawing.revisedModel, a.doc.drawing.revisedModel);
  assert.equal(b.source, changed.source);
  await settings.getByLabel('Sheet size', { exact: true }).selectOption('A3');
  const paper = await binding('issue-B-A3-width-85', 55, 'B', false);
  assert.equal(paper.doc.drawing.sheet, 'A3');
  assert.equal(paper.doc.drawing.revisedModel, b.doc.drawing.revisedModel);
  assert.equal(paper.source, b.source);

  f.phase = 'Save, close and reopen the issued native assembly drawing';
  await mode('Model');
  const project = 'D763 issued assembly drawing';
  const versions = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const attach = async () => {
    if (!(await versions.isVisible())) await button('Project and versions').click();
    await versions.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await versions.getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await versions.getByLabel('Project', { exact: true }).waitFor();
  };
  await attach();
  await button('Save').click();
  await versions.getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await page.evaluate(async ([project, file]) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, [project, file]);
  assert.deepEqual(JSON.parse(saved), paper.doc);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await versions.getByRole('button', { name: 'Close project', exact: true }).click();
  await versions.getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await versions.getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(paper.doc);
  await mode('Drawing');
  assert.equal((await binding('fresh-open-issued-B', 55, 'B', false)).source, b.source);
  await move(40);
  const reopenedEdit = await binding('post-open-stale-B-width-70', 40, 'B', true);
  assert.equal(reopenedEdit.source, a.source);
  assert.deepEqual(reopenedEdit.doc.drawing, paper.doc.drawing);
  assert.deepEqual(f.report.downloads, []);
});
