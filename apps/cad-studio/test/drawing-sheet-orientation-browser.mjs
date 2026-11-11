// D752/D753: drawing orientation and Auto-dimension must preserve the owning sheets.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const automatic = mode === '--auto' || mode === '--auto-baseline';
const baseline = mode === '--baseline' || mode === '--auto-baseline';
const fixtureName = automatic ? 'orient-cross-hole-y-plus' : 'orient-plate-x-plus';
const fixturePath = `packages/barocss-cad/conformance/r14/${fixtureName}/case.json`;
const fixtureBytes = await readFile(fixturePath);
const fixture = JSON.parse(fixtureBytes);
const manual = automatic ? { ...fixture.input.drawing.dimensions.find(dim => dim.id === 'd6'), id: 'retained-hole' } : null;
if (manual) delete manual.auto;
const source = {
  ...fixture.input.document,
  drawing: {
    ...fixture.input.drawing,
    title: 'Two-sheet orientation fixture',
    ...(manual ? { dimensions: [manual] } : {}),
    sheets: [{ id: 'S2', name: 'Continuation', size: 'A3', scale: 1, views: [automatic ? 'right' : 'front'] }],
    notes: [
      { id: 'n-first', text: 'FIRST SHEET CONTROL', at: [130, 70] },
      { id: 'n-second', text: 'CONTINUATION CONTROL', at: [150, 80], sheet: 'S2' },
    ],
  },
};
const pins = [
  'apps/cad-studio/test/drawing-sheet-orientation-browser.mjs', 'apps/cad-studio/src/ui/DrawingWorkspace.tsx',
  'apps/cad-studio/src/ui/useDrawingSheet.ts', 'packages/barocss-cad-model/src/drawing/reorient.ts',
  'packages/barocss-cad-model/src/drawing/sheets.ts', fixturePath,
];
const f = await createFlow({
  name: 'drawing-sheet-orientation', output, envFrozen: automatic ? 'D753_SOURCE_FROZEN' : 'D752_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: automatic ? 'Keep Auto-dimension within the active sheet'
    : baseline ? 'Reproduce wrong dimension ownership after Front from on a drawing set' : 'Preserve global orientation and sheet ownership',
  limits: ['Two sheets of an ordinary plate drawing. Controlled delay changes only delivery time. SVG bytes are captured locally before file delivery.'],
  snapshotExtra: () => ({
    readout: window.__studioDrawing?.(),
    activeSheet: document.querySelector('[role="tablist"][aria-label="Sheets"] [aria-selected="true"]')?.textContent ?? null,
    undo: document.querySelector('[aria-label="Undo"]')?.getAttribute('data-tip'),
    redo: document.querySelector('[aria-label="Redo"]')?.getAttribute('data-tip'),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
  oracleSource: String.raw`
import json, sys, xml.etree.ElementTree as ET
arg = json.load(sys.stdin)
ns = {"s": "http://www.w3.org/2000/svg"}
if "automatic" in arg:
    sibling = ET.fromstring(arg["automatic"]["sibling"])
    assert sibling.attrib["width"] == "420mm", sibling.attrib
    dims = sibling.findall(".//s:g[@class='dimension'][@data-dim]", ns)
    assert len(dims) == 1 and dims[0].attrib["data-dim"] == "retained-hole"
    assert "".join(dims[0].itertext()).strip() == "Ø8 THRU"
    assert any(node.text == "CONTINUATION CONTROL" for node in sibling.findall(".//s:text", ns))
    if "active" in arg["automatic"]:
        active = ET.fromstring(arg["automatic"]["active"])
        dims = active.findall(".//s:g[@class='dimension'][@data-dim]", ns)
        assert sorted("".join(d.itertext()).strip() for d in dims) == ["30", "30", "60"]
        assert all(d.attrib["data-view"] in ["front", "top"] for d in dims)
        assert any(node.text == "FIRST SHEET CONTROL" for node in active.findall(".//s:text", ns))
    print(json.dumps({"status": "PASS"}))
    sys.exit(0)
physical = {"d1": "32", "d2": "16", "d3": "32", "d4": "Ø8", "d5": "64", "d6": "8"}
for index, data in enumerate(arg["sheets"]):
    root = ET.fromstring(data)
    assert root.attrib["width"] == ["297mm", "420mm"][index], root.attrib
    wanted = set(["d1", "d2", "d3", "d4"] if index == 0 else ["d5", "d6"])
    found = root.findall(".//s:g[@class='dimension'][@data-dim]", ns)
    assert len(found) == len(wanted), [(g.attrib, list(g.itertext())) for g in found]
    assert {group.attrib["data-dim"] for group in found} == wanted
    for group in found:
        dim = group.attrib["data-dim"]
        assert "".join(group.itertext()).strip().removesuffix(" THRU") == physical[dim], (dim, list(group.itertext()))
    text = [node.text for node in root.findall(".//s:text", ns)]
    assert ["FIRST SHEET CONTROL", "CONTINUATION CONTROL"][index] in text
    assert ["CONTINUATION CONTROL", "FIRST SHEET CONTROL"][index] not in text
print(json.dumps({"status": "PASS", "dimensionCount": 6, "sheets": 2}))
`,
});

function instrument() {
  const post = Worker.prototype.postMessage;
  const onmessage = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
  let armed = false, target, held, deliver;
  const requests = [];
  Worker.prototype.postMessage = function (request, ...args) {
    if (request?.type === 'drawing') requests.push({ id: request.id, orientation: request.options?.orientation ?? 'y-' });
    if (armed && request?.type === 'drawing' && request.options?.orientation === 'x+') {
      armed = false;
      target = { worker: this, id: request.id };
    }
    return Reflect.apply(post, this, [request, ...args]);
  };
  Object.defineProperty(Worker.prototype, 'onmessage', {
    configurable: true, get: onmessage.get,
    set(callback) {
      onmessage.set.call(this, callback && function (event) {
        if (target?.worker === this && event.data?.id === target.id && event.data.drawing) {
          held = { id: target.id, ok: event.data.drawing.ok };
          deliver = () => callback.call(this, event);
          return;
        }
        callback.call(this, event);
      });
    },
  });
  const create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click, blobs = new Map();
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    if (blob instanceof Blob && blob.type === 'image/svg+xml') blobs.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const blob = blobs.get(this.href);
    if (!blob || !this.download.endsWith('.svg')) return click.call(this);
    window.__d752Svg = blob.text().then(text => ({ name: this.download, text }));
    blobs.delete(this.href);
  };
  window.__d752 = {
    arm() { if (armed || target) throw new Error('Only one projection can be held'); armed = true; },
    held: () => held ?? null,
    requests: () => requests,
    release() {
      if (!deliver) throw new Error('One genuine projection must be held');
      const run = deliver;
      deliver = held = target = null;
      run();
    },
  };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.addInitScript(instrument);
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
  const front = () => page.getByLabel('Front view side', { exact: true });
  const selectSheet = async name => {
    await tab(name).click();
    assert.equal(await tab(name).getAttribute('aria-selected'), 'true');
    await page.locator('svg[aria-label="Drawing sheet"]').waitFor();
  };
  const waitSize = size => page.waitForFunction(value => document.querySelector('[aria-label="Sheet size"]')?.value === value, size);
  const capture = async label => {
    await page.evaluate(() => { window.__d752Svg = null; });
    await button('Export SVG').click();
    await page.waitForFunction(() => !!window.__d752Svg);
    const { name, text } = await page.evaluate(() => window.__d752Svg);
    f.report.files.push({ label, name, sha256: sha256(text) });
    return text;
  };
  const reads = async ids => {
    const states = await page.evaluate(() => window.__studioDrawing().dimensions);
    assert.deepEqual(states.map(item => item.id).sort(), ids);
    return states;
  };

  const openFile = async (doc, file) => {
    const bytes = Buffer.from(JSON.stringify(doc));
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
    await page.waitForFunction(title => window.__studioDoc?.drawing?.title === title, doc.drawing.title);
    await f.ready();
    return bytes;
  };
  const waitHeld = async () => (await page.waitForFunction(() => window.__d752.held())).jsonValue();
  const release = async () => {
    await page.evaluate(() => window.__d752.release());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };

  f.phase = 'Open the retained two-sheet drawing';
  const file = automatic ? 'sheet-auto-dimension.bcad' : 'sheet-orientation.bcad';
  const bytes = await openFile(source, file);
  const original = await f.doc();
  assert.deepEqual(original.drawing.sheets, source.drawing.sheets);
  f.report.observations.push({ fixtureSHA256: sha256(fixtureBytes), authoredSHA256: sha256(bytes) });
  const saveOpen = async (accepted, ids, values) => {
    const project = automatic ? 'D753 sheet Auto' : 'D752 drawing orientation';
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
    assert.deepEqual(JSON.parse(saved), accepted);
    f.report.files.push({ name: file, sha256: sha256(saved) });
    await panel().getByRole('button', { name: 'Close project', exact: true }).click();
    await panel().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
    await page.reload();
    await f.ready();
    await attach();
    await panel().getByRole('button', { name: 'Open ' + file, exact: true }).click();
    await f.same(accepted);
    await modeButton('Drawing').click();
    await selectSheet('Continuation');
    const restored = await reads(ids);
    restored.forEach((item, index) => assert.ok(Math.abs(item.value - values[index]) < 1e-8));
    await f.snapshot('fresh-open-continuation');
  };

  await modeButton('Drawing').click();
  await selectSheet('Sheet 1');
  assert.equal(await front().inputValue(), 'y-');
  if (automatic) {
    f.phase = 'Auto-dimension on sheet 1 with a manual Ø8 on the continuation';
    await selectSheet('Continuation');
    assert.ok(Math.abs((await reads(['retained-hole']))[0].value - 8) < 1e-8);
    const before = await capture('before-auto-continuation');
    await f.runOracle({ automatic: { sibling: before } }, 'before-auto-oracle');
    await f.snapshot('authored-continuation-diameter');
    await selectSheet('Sheet 1');
    const previous = (await page.evaluate(() => window.__d752.requests())).length;
    if (baseline) await page.evaluate(() => window.__d752.arm());
    await button('Auto-dimension').click();
    if (baseline) {
      const projection = await waitHeld();
      assert.equal(projection.ok, true);
      f.report.observations.push({ automaticProjection: projection });
      await release();
    }
    await f.changed(original);
    const notice = await f.waitToast(/\d+ dimensions? placed/);
    const after = await f.snapshot('auto-dimension-result');
    assert.deepEqual(after.doc.nodes, original.nodes);
    if (baseline) {
      assert.equal(after.doc.drawing.orientation, 'x+');
      assert.match(notice, /front seen from \+X/);
      await selectSheet('Continuation');
      const sibling = await f.snapshot('continuation-after-automatic-turn');
      const diameter = sibling.readout?.dimensions.find(dim => dim.id === 'retained-hole');
      assert.ok(!diameter || typeof diameter.value !== 'number', JSON.stringify(diameter));
      return;
    }
    assert.equal(after.doc.drawing.orientation, undefined);
    assert.deepEqual(after.doc.drawing.sheets, original.drawing.sheets);
    assert.deepEqual(after.doc.drawing.notes, original.drawing.notes);
    assert.deepEqual(after.doc.drawing.dimensions.find(dim => dim.id === 'retained-hole'), original.drawing.dimensions[0]);
    const requests = (await page.evaluate(() => window.__d752.requests())).slice(previous);
    assert.ok(requests.every(request => request.orientation === 'y-'));
    assert.doesNotMatch(notice, /front seen from/);
    f.report.observations.push({ notice, requests });
    const afterFirst = await capture('automatic-active-sheet');
    await selectSheet('Continuation');
    const afterSecond = await capture('automatic-retained-continuation');
    await f.runOracle({ automatic: { active: afterFirst, sibling: afterSecond } }, 'after-auto-oracle');
    await f.snapshot('automatic-preserves-continuation');
    await button('Undo').click();
    await f.same(original);
    await button('Redo').click();
    await f.same(after.doc);
    await saveOpen(after.doc, ['retained-hole'], [8]);

    f.phase = 'Single-sheet Auto-dimension reply after leaving Drawing and replacing the part';
    const single = { ...fixture.input.document, drawing: { sheet: 'A4', projection: 'third', hidden: true, dimensions: [], title: 'Single sheet Auto' } };
    await modeButton('Model').click();
    await openFile(single, 'single-sheet-auto.bcad');
    await modeButton('Drawing').click();
    await page.locator('svg[aria-label="Drawing sheet"]').waitFor();
    await page.evaluate(() => window.__d752.arm());
    await button('Auto-dimension').click();
    const projection = await waitHeld();
    assert.equal(projection.ok, true);
    await modeButton('Model').click();
    await button('New part').click();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.ready();
    const replacement = await f.snapshot('replacement-before-old-auto-reply');
    await release();
    await f.same(replacement.doc);
    const late = await f.snapshot('replacement-after-old-auto-reply');
    for (const key of ['doc', 'undo', 'redo', 'history', 'dirty']) assert.deepEqual(late[key], replacement[key]);
    assert.ok(late.notices.every(item => !/dimensions? placed/.test(item)));
    f.report.observations.push({ held: projection, afterWorkspaceExit: late.notices });
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  await reads(['d1', 'd2', 'd3', 'd4']);
  const priorFirst = await capture('original-sheet-1');
  await selectSheet('Continuation');
  await waitSize('A3');
  const priorSecondValues = await reads(['d5', 'd6']);
  assert.deepEqual(priorSecondValues.map(item => item.value), [64, 8]);
  const priorSecond = await capture('original-sheet-2');
  await f.snapshot('original-continuation-dimensions');
  await f.runOracle({ sheets: [priorFirst, priorSecond] }, 'original-two-sheets');

  f.phase = 'A newer continuation size retires a held Front from request';
  await selectSheet('Sheet 1');
  await page.evaluate(() => window.__d752.arm());
  await front().selectOption('x+');
  const held = await (await page.waitForFunction(() => window.__d752.held())).jsonValue();
  assert.equal(held.ok, true);
  await selectSheet('Continuation');
  await page.getByLabel('Sheet size', { exact: true }).selectOption('A4');
  await page.waitForFunction(() => window.__studioDoc.drawing.sheets[0].size === 'A4');
  const newer = await f.snapshot('continuation-size-committed');
  await page.evaluate(() => window.__d752.release());
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const stale = await f.snapshot('stale-turn-with-continuation-edit');
  for (const field of ['doc', 'history', 'undo', 'redo', 'activeSheet', 'dirty']) assert.deepEqual(stale[field], newer[field], field);
  assert.ok(stale.notices.every(notice => !/Front now seen from/.test(notice)));
  f.report.observations.push({ held, lateNotice: stale.notices });
  await button('Undo').click();
  await f.same(original);
  await waitSize('A3');
  await f.dismissToasts();

  f.phase = 'A current Front from +X preserves both sheets and six dimensions';
  await selectSheet('Sheet 1');
  await front().selectOption('x+');
  await page.waitForFunction(() => window.__studioDoc?.drawing?.orientation === 'x+');
  await f.waitToast(/Front now seen from/);
  await selectSheet('Sheet 1');
  const turned = await f.snapshot('accepted-front-from-x');
  assert.deepEqual(turned.doc.nodes, original.nodes);
  assert.deepEqual(turned.doc.drawing.notes, original.drawing.notes);
  const dims = turned.doc.drawing.dimensions;
  if (baseline) {
    assert.equal(dims.find(dim => dim.id === 'd5').view, 'front');
    assert.deepEqual(turned.doc.drawing.sheets[0].views, []);
    assert.deepEqual(turned.readout.dimensions.filter(dim => dim.lost).map(dim => dim.id), ['d5', 'd6']);
    return;
  }
  assert.deepEqual(turned.doc.drawing.sheets, [{ ...original.drawing.sheets[0], views: ['right'] }]);
  assert.equal(dims.find(dim => dim.id === 'd5').view, 'right');
  assert.equal(dims.find(dim => dim.id === 'd6').view, 'right');
  for (const originalDim of original.drawing.dimensions) {
    const dim = dims.find(entry => entry.id === originalDim.id);
    assert.ok(dim);
    assert.deepEqual([dim.a, dim.b, dim.edge, dim.near], [originalDim.a, originalDim.b, originalDim.edge, originalDim.near]);
  }
  await reads(['d1', 'd2', 'd3', 'd4']);
  const afterFirst = await capture('turned-sheet-1');
  await selectSheet('Continuation');
  assert.deepEqual((await reads(['d5', 'd6'])).map(item => item.value), [64, 8]);
  const afterSecond = await capture('turned-sheet-2');
  await f.runOracle({ sheets: [afterFirst, afterSecond] }, 'turned-two-sheets');
  await f.snapshot('turned-continuation-retains-dimensions');
  await button('Undo').click();
  await f.same(original);
  await button('Redo').click();
  await f.same(turned.doc);

  await saveOpen(turned.doc, ['d5', 'd6'], [64, 8]);
  assert.deepEqual(f.report.downloads, []);
});
