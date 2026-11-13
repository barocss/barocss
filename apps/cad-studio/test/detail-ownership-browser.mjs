// Desktop acceptance for #2366. Run under the heavy gate with D701_SOURCE_FROZEN=1.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2), repo = resolve(import.meta.dirname, '../../..');
assert.ok(output && isAbsolute(output) && relative(repo, output).startsWith('../'));
assert.ok(['--baseline', '--fixed', '--issue-move-baseline', '--issue-move-fixed', '--issue-fix-all-baseline', '--issue-fix-all-fixed', '--issue-split-move-baseline', '--issue-split-move-fixed'].includes(mode));
const issueMove = mode.startsWith('--issue-move-');
const issueFixAll = mode.startsWith('--issue-fix-all-');
const splitMove = mode.startsWith('--issue-split-move-');
const splitDetail = issueFixAll || splitMove;
await mkdir(output, { recursive: true });
const modelPath = join(repo, 'packages/barocss-cad/conformance/r14/starter-plate/case.json');
const { input: { document: model } } = JSON.parse(await readFile(modelPath));
const detailB = { id: 'B', view: 'top', center: [32, 16], radius: 6, scale: 5, at: [310, 85] };
const detailC = { id: 'C', view: 'top', center: [32, 16], radius: 5, scale: 5, at: [330, 170] };
const detailDimension = { id: 'b-diameter', kind: 'diameter', view: 'detail:B', edge: 'n1.top|n2.side0#1',
  near: [32, 16, 8], place: [41, 21], tol: { kind: 'symmetric', value: 0.15 } };
const control = { ...detailDimension, id: 'top-diameter', view: 'top', place: [58, 25], tol: { kind: 'symmetric', value: 0.25 } };
const otherDetail = { ...detailDimension, id: 'c-diameter', view: 'detail:C', tol: { kind: 'symmetric', value: 0.35 } };
const attached = { id: 'b-attached', characteristic: 'flatness', value: 0.05, datums: [], dim: 'b-diameter' };
const standalone = { id: 'b-frame', characteristic: 'flatness', value: 0.07, datums: [], view: 'detail:B', place: [40, 9] };
const drawing = { scope: { kind: 'part' }, sheet: 'A3', projection: 'third', scale: 2, hidden: false,
  title: 'Detail annotation ownership', views: ['front', 'top'], details: [detailB], dimensions: [detailDimension, control] };
const fixtures = {
  'bound-detail': drawing,
  'split-detail': { ...drawing, details: [detailB, detailC], dimensions: [...drawing.dimensions, otherDetail], frames: [attached, standalone],
    sheets: [{ id: 's2', views: ['detail:B'] }] },
  'legacy-detail': { ...drawing, details: [detailC], dimensions: [...drawing.dimensions, otherDetail], frames: [attached, standalone],
    sheets: [{ id: 's2', views: ['detail:B', 'detail:E'] }] },
};
const moveModel = { ...model, nodes: model.nodes.map(node => node.kind === 'hole' ? { ...node, radius: 6 } : node) };
if (issueMove || splitDetail) fixtures['issue-move'] = {
  ...drawing,
  details: [{ ...detailB, radius: 9, scale: 2 }],
  dimensions: [detailDimension],
  frames: [attached, standalone],
  ...(splitDetail ? { sheets: [{ id: 's2', views: ['detail:B'] }] } : {}),
};
const files = new Map();
for (const [key, settings] of Object.entries(fixtures)) {
  const path = join(output, `${key}.bcad`);
  await writeFile(path, JSON.stringify({ ...(key === 'issue-move' ? moveModel : model), drawing: settings }), { flag: 'wx' });
  files.set(key, path);
}

const oracle = `
import json
import re
import sys
import xml.etree.ElementTree as ET

r = json.load(sys.stdin)
ns = {"svg": "http://www.w3.org/2000/svg"}
root = ET.parse(r["file"]).getroot()
assert (root.get("width"), root.get("height")) == ("420mm", "297mm")
groups = root.findall(".//svg:g", ns)
details = {g.get("data-view")[7:]: g for g in groups if g.get("class") == "detail" and g.get("data-view", "").startswith("detail:")}
assert set(details) == set(r["details"])
for letter, scale in r["details"].items():
    if scale is None:
        continue
    # A complete native Ø8 hole is two visible semicircles, scaled in sheet mm.
    rim = [p for p in details[letter].findall("svg:path[@stroke-width='0.5']", ns)
           if re.search(rf"A{4*scale:g} {4*scale:g} ", p.get("d"))]
    assert len(rim) == 2, (letter, [p.get("d") for p in rim])
dims = {g.get("data-dim"): g for g in groups if g.get("class") == "dimension"}
assert set(dims) == set(r["dims"])
for id, view in r["dims"].items():
    dim = dims[id]
    assert dim.get("data-view") == view
    texts = [t.text for t in dim.findall("svg:text", ns)]
    assert any("Ø8" in text for text in texts)
    tol = {"b-diameter": "0.15", "top-diameter": "0.25", "c-diameter": "0.35"}[id]
    assert any(tol in text for text in texts), (id, texts)
controls = {g.get("data-standalone-frame") or g.get("data-dim"): g.get("data-view")
            for g in groups if g.get("class") == "control"}
assert controls == {id: "detail:B" for id in r["frames"]}, controls
print(json.dumps({"status": "PASS", "details": r["details"], "dimensions": r["dims"], "frames": r["frames"]}))
`;

const f = await createFlow({
  name: 'detail-ownership', envFrozen: splitMove ? 'D981_SOURCE_FROZEN' : issueFixAll ? 'D980_SOURCE_FROZEN' : issueMove ? 'D979_SOURCE_FROZEN' : 'D701_SOURCE_FROZEN', output,
  qualification: splitMove ? 'Move an empty detail on its parent sheet and retain its separate sheet assignment.' : issueFixAll ? 'Keep an annotated split detail and report unresolved issues after Fix all.' : issueMove ? 'Repair an empty Detail boundary and keep its authored annotations.' : 'Detail reference ownership through real Studio controls, first Undo/Redo, native Save and fresh Open, and independent SVG readback.',
  initialFiles: [import.meta.filename, modelPath, ...files.values()], oracleSource: oracle,
  extraFrozen: ['packages/barocss-cad-model/src/drawing/issues.ts', 'packages/barocss-cad-model/src/drawing/detail.ts', 'packages/barocss-cad-model/src/drawing/types.ts',
    'packages/barocss-cad-model/src/drawing/sheets.ts', 'packages/barocss-cad-model/src/drawing/options.ts',
    'apps/cad-studio/src/ui/drawing/DetailsList.tsx', 'apps/cad-studio/src/ui/DrawingWorkspace.tsx'],
  limits: ['Capture local emitted bytes before browser delivery. No PDF or standards verification.'],
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
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob);
        if (blob instanceof Blob) blobs.set(url, blob);
        return url;
      };
      HTMLAnchorElement.prototype.click = function () {
        const blob = blobs.get(this.href), name = this.download;
        if (!blob || !/\.(bcad|svg)$/.test(name)) return click.call(this);
        window.__detailFile = blob.arrayBuffer().then(bytes => ({ name, bytes: [...new Uint8Array(bytes)] }));
        blobs.delete(this.href);
      };
    });
    return context;
  };
};

const button = name => f.page.getByRole('button', { name, exact: true });
const svg = 'svg[aria-label="Drawing sheet"]';
const timeout = 60000;
const state = () => f.page.evaluate(() => window.__studioDrawing());
async function open(path) {
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(path);
  await f.page.waitForFunction(() => window.__studioDoc?.drawing?.title === 'Detail annotation ownership', null, { timeout });
  await f.ready();
  await button('Drawing').click();
  await f.page.waitForFunction(() => !!window.__studioDrawing?.(), null, { timeout });
}
async function capture(command, label) {
  await f.page.evaluate(() => { window.__detailFile = null; });
  await button(command).click();
  await f.page.waitForFunction(() => !!window.__detailFile, null, { timeout });
  const { name, bytes } = await f.page.evaluate(() => window.__detailFile);
  const file = join(output, label + '-' + name), buffer = Buffer.from(bytes);
  await writeFile(file, buffer, { flag: 'wx' });
  f.report.files.push({ label, name, sha256: sha256(buffer) });
  return { file, buffer };
}
async function save(label) {
  const doc = await f.doc(), { file, buffer } = await capture('Save', label);
  assert.deepEqual(JSON.parse(buffer), doc);
  return { file, doc };
}
async function exportSvg(label, details, dims, frames = []) {
  const { file } = await capture('Export SVG', label);
  await f.runOracle({ file, details, dims, frames }, label);
}
async function pointAt(view, x, y) {
  const point = await f.page.evaluate(([v, u, w]) => window.__studioDrawingAt(v, u, w), [view, x, y]);
  assert.ok(point && point.x > 50 && point.x < 875 && point.y > 80 && point.y < 900, JSON.stringify(point));
  return point;
}
async function clickAt(view, x, y) {
  const { x: px, y: py } = await pointAt(view, x, y);
  await f.page.mouse.click(px, py);
}
async function addDetail(view, x, y, radius) {
  const before = await f.doc();
  await button('Detail view').click();
  await clickAt(view, x, y);
  await f.page.locator('.dw-hint').getByText(/how far the detail/).waitFor();
  await clickAt(view, x + radius, y);
  await f.changed(before);
  const newDetail = (await f.doc()).drawing.details.at(-1);
  assert.equal(newDetail.view, view);
  assert.ok(Math.abs(newDetail.radius - radius) < 0.6, JSON.stringify(newDetail));
  return newDetail;
}
async function checkDimension(id, view, value = 8) {
  await f.page.locator(`${svg} g.dimension[data-dim="${id}"][data-view="${view}"]`).waitFor();
  const dim = (await state()).dimensions.find(row => row.id === id);
  assert.ok(Math.abs(dim.value - value) < 1e-8, JSON.stringify(dim));
  return dim;
}
async function checkLost(id) {
  await f.page.waitForFunction(id => window.__studioDrawing?.()?.dimensions.some(d => d.id === id && d.lost), id, { timeout });
  assert.equal(await f.page.locator(`${svg} g.dimension[data-dim="${id}"]`).count(), 0);
}
async function tab(n) {
  const target = f.page.getByRole('tab', { name: `Sheet ${n}`, exact: true });
  await target.click();
  assert.equal(await target.getAttribute('aria-selected'), 'true');
}
async function history() {
  return {
    undo: await button('Undo').isEnabled(), redo: await button('Redo').isEnabled(),
    dirty: await f.page.locator('[aria-label="Unsaved changes"]').count(),
  };
}

async function refuse(id, label, repeats = 1) {
  f.phase = label;
  const before = await f.doc(), earlier = await history();
  for (let i = 0; i < repeats; i++) {
    await button(`Remove detail ${id}`).click();
    await f.page.locator('.dw-hint').getByText(`Detail ${id} has dimensions or geometric controls. Remove those annotations first.`, { exact: true }).waitFor();
    await f.same(before);
    assert.deepEqual(await history(), earlier);
  }
  f.report.observations.push({ label, repeats, history: earlier });
  await f.persist();
}
function checkGeometry(doc) {
  const geometry = { ...doc };
  delete geometry.drawing;
  assert.deepEqual(geometry, model);
}
const topDim = { 'top-diameter': 'top' };
const topAndC = { ...topDim, 'c-diameter': 'detail:C' };
const bDim = { 'b-diameter': 'detail:B' };

async function openEmptyDetail() {
  f.phase = 'open a 64 × 32 × 8 mm plate with an annotated Ø12 Detail B';
  await open(files.get('issue-move'));
  const original = await f.doc();
  if (splitDetail) await tab(2);
  await checkDimension('b-diameter', 'detail:B', 12);
  const sheet = f.page.locator(svg);
  await sheet.locator('g.control[data-standalone-frame="b-frame"]').waitFor();
  await sheet.locator('g.control[data-dim="b-attached"]').waitFor();
  await button('Model').click();
  await f.openFeatureEditor(2, 'source Hole');
  f.phase = 'move the Hole centre from [32,16] to [48,16] in History';
  await f.editor().getByLabel('Centre X', { exact: true }).fill('48');
  await f.applyEditor(original, 'hole-outside-detail');
  await button('Drawing').click();
  if (splitDetail) await tab(2);
  await checkLost('b-diameter');
  const emptyIssue = f.page.locator('.dw-issue[title="DETAIL_EMPTY"]');
  await emptyIssue.waitFor();
  const empty = await f.doc();
  assert.deepEqual(empty.nodes[2].center, [48, 16]);
  assert.equal(empty.nodes[2].radius, 6);
  assert.deepEqual(empty.drawing.details, original.drawing.details);
  return { empty, emptyIssue };
}

async function checkIssueMove() {
  const { empty, emptyIssue } = await openEmptyDetail();
  const move = emptyIssue.getByRole('button', { name: /^Fix: Detail B/ });
  assert.equal(await move.textContent(), 'Move');
  f.phase = 'use Move on the empty Detail issue';
  await move.click();
  if (splitMove && mode.endsWith('baseline')) {
    await f.page.locator('.dw-hint').getByText('Show the current parent view before moving the detail.').waitFor();
    assert.equal(await f.page.getByRole('tab', { name: 'Sheet 2', exact: true }).getAttribute('aria-selected'), 'true');
    await f.same(empty);
    await f.snapshot('split-move-cannot-reach-parent');
    assert.fail('Move cannot start when the empty detail and its parent are on different sheets');
  }
  if (mode.endsWith('baseline')) {
    await f.changed(empty);
    const after = await f.doc();
    assert.equal(after.drawing.details?.some(d => d.id === 'B') ?? false, false);
    assert.equal(after.drawing.dimensions.some(d => d.id === 'b-diameter'), false);
    assert.ok(after.drawing.frames.some(frame => frame.id === 'b-frame'));
    await f.snapshot('issue-move-deleted-detail');
    assert.fail('Move removed Detail B and its diameter while leaving a standalone frame without a view');
  }
  await f.same(empty);
  await f.page.locator('.dw-hint').getByText(/centre.*detail B/i).waitFor();
  if (splitMove) {
    assert.equal(await f.page.getByRole('tab', { name: 'Sheet 1', exact: true }).getAttribute('aria-selected'), 'true');
    await f.page.keyboard.press('Escape');
    await f.same(empty);
    await tab(2);
    await emptyIssue.getByRole('button', { name: /^Fix: Detail B/ }).click();
    await f.page.locator('.dw-hint').getByText(/centre.*detail B/i).waitFor();
  }
  await clickAt('top', 48, 16);
  await f.page.locator('.dw-hint').getByText(/how far the detail/).waitFor();
  await clickAt('top', 57, 16);
  await f.changed(empty);
  const repaired = await f.doc();
  const detail = repaired.drawing.details.find(d => d.id === 'B');
  assert.deepEqual(detail.center, [48, 16]);
  assert.ok(Math.abs(detail.radius - 9) < 0.15, JSON.stringify(detail));
  assert.deepEqual(repaired.drawing.dimensions, empty.drawing.dimensions);
  assert.deepEqual(repaired.drawing.frames, empty.drawing.frames);
  assert.deepEqual(repaired.nodes, empty.nodes);
  assert.deepEqual(repaired.drawing.sheets, empty.drawing.sheets);
  if (splitMove) await tab(2);
  await checkDimension('b-diameter', 'detail:B', 12);
  await emptyIssue.waitFor({ state: 'hidden' });
  await f.snapshot('issue-move-repaired-detail');
  await f.undo();
  await f.same(empty);
  await emptyIssue.waitFor();
  await f.redo();
  await f.same(repaired);
  await checkDimension('b-diameter', 'detail:B', 12);
  await f.snapshot('issue-move-redo');
}

async function checkIssueFixAll() {
  const { empty, emptyIssue } = await openEmptyDetail();
  const fixAll = button('Fix all issues');
  const outcome = f.page.getByRole('alert').filter({ hasText: /fix(?:es)? applied/i });
  f.phase = 'run Fix all on the sheet that owns Detail B';
  await fixAll.click();
  await outcome.waitFor();
  const fixed = await f.doc();
  if (mode.endsWith('baseline')) {
    assert.equal(fixed.drawing.details?.some(d => d.id === 'B') ?? false, false);
    assert.equal(fixed.drawing.dimensions.some(d => d.id === 'b-diameter'), false);
    assert.ok(fixed.drawing.frames.some(frame => frame.id === 'b-frame'));
    await f.snapshot('fix-all-lost-detail-annotations');
    assert.fail('Fix all removed Detail B and its annotations on sheet 2');
  }
  assert.deepEqual(fixed.drawing.details, empty.drawing.details);
  assert.deepEqual(fixed.drawing.sheets, empty.drawing.sheets);
  assert.deepEqual(fixed.drawing.frames, empty.drawing.frames);
  assert.deepEqual(fixed.drawing.dimensions.find(d => d.id === 'b-diameter'), empty.drawing.dimensions[0]);
  assert.deepEqual(fixed.nodes, empty.nodes);
  assert.match(await outcome.textContent(), /annotations preserved.*issue/i);
  await emptyIssue.waitFor();
  await checkLost('b-diameter');
  await f.snapshot('fix-all-preserved-detail');
  await tab(1);
  await f.same(fixed);
  await tab(2);
  await emptyIssue.waitFor();
}

await f.run(async () => {
  if (issueFixAll) { await checkIssueFixAll(); return; }
  if (issueMove || splitMove) { await checkIssueMove(); return; }
  f.phase = 'open original Detail B';
  await open(files.get('bound-detail'));
  const original = await f.doc();
  await checkDimension('b-diameter', 'detail:B');
  await exportSvg('original', { B: 5 }, { 'b-diameter': 'detail:B', 'top-diameter': 'top' });

  if (mode === '--baseline') {
    f.phase = 'remove Detail B on parent';
    await button('Remove detail B').click();
    await f.changed(original);
    assert.equal((await f.doc()).drawing.details, undefined);
    assert.deepEqual((await f.doc()).drawing.dimensions, original.drawing.dimensions);
    await checkLost('b-diameter');
    await exportSvg('deleted', {}, { 'top-diameter': 'top' });
    f.phase = 'recreate Detail B on parent';
    const created = await addDetail('top', 32, 16, 7);
    assert.equal(created.id, 'B');
    const dim = await checkDimension('b-diameter', 'detail:B');
    assert.deepEqual((await f.doc()).drawing.dimensions, original.drawing.dimensions);
    await exportSvg('silently-inherited', { B: 5 }, { 'b-diameter': 'detail:B', 'top-diameter': 'top' });
    f.report.observations.push({ created, dim });
    await f.snapshot('silently-inherited');
    assert.fail('A newly created Detail B acquires the old dimension and its tolerance');
  }

  await refuse('B', 'refuse-on-clean-open', 2);
  await f.snapshot('refused-clean');

  f.phase = 'edit the source hole';
  await button('Model').click();
  await f.openFeatureEditor(2, 'source hole');
  await f.editor().getByLabel('Diameter', { exact: true }).fill('10');
  await f.applyEditor(original, 'source-hole-10');
  const edited = await f.doc();
  assert.deepEqual(edited.nodes, model.nodes.map(node => node.kind === 'hole' ? { ...node, radius: 5 } : node));
  assert.deepEqual(edited.drawing.dimensions.map(({ sig: _sig, ...d }) => d), original.drawing.dimensions);
  await button('Drawing').click();
  await checkDimension('b-diameter', 'detail:B', 10);
  await f.undo();
  await f.same(original);
  await checkDimension('b-diameter', 'detail:B');

  f.phase = 'open split detail with both kinds of frame';
  await open(files.get('split-detail'));
  const split = await f.doc();
  await refuse('B', 'refuse-from-parent-marker');
  await exportSvg('split-parent', { C: 5 }, topAndC);
  await tab(2);
  await checkDimension('b-diameter', 'detail:B');
  await refuse('B', 'refuse-on-detail-sheet');
  await exportSvg('split-detail', { B: 5 }, bDim, ['b-attached', 'b-frame']);

  f.phase = 'scale referenced detail';
  await f.page.getByLabel('Detail B scale', { exact: true }).selectOption('2');
  await f.changed(split);
  const scaled = await f.doc();
  assert.deepEqual(scaled.drawing.details, [{ ...detailB, scale: 2 }, detailC]);
  assert.deepEqual(scaled.drawing.dimensions, split.drawing.dimensions);
  assert.deepEqual(scaled.drawing.frames, split.drawing.frames);
  await f.undo();
  await f.same(split);
  await refuse('B', 'refuse-preserves-redo');
  await f.redo();
  await f.same(scaled);
  await exportSvg('split-scaled', { B: 2 }, bDim, ['b-attached', 'b-frame']);

  f.phase = 'move referenced detail';
  await button('Select').click();
  const startPoint = await pointAt('detail:B', 36.5, 19);
  await f.page.mouse.move(startPoint.x, startPoint.y);
  await f.page.mouse.down();
  await f.page.mouse.move(startPoint.x - 25, startPoint.y + 15, { steps: 5 });
  await f.page.mouse.up();
  await f.changed(scaled);
  const moved = await f.doc();
  assert.notDeepEqual(moved.drawing.details[0].at, scaled.drawing.details[0].at);
  assert.deepEqual(moved.drawing.dimensions, scaled.drawing.dimensions);
  assert.deepEqual(moved.drawing.frames, scaled.drawing.frames);
  await exportSvg('split-moved', { B: 2 }, bDim, ['b-attached', 'b-frame']);

  f.phase = 'explicit annotation removal';
  const dimRow = f.page.locator('.dw-dims .dw-dim').filter({ hasText: 'diameter · detail:B' });
  await dimRow.click();
  await button('Remove geometric control').click();
  await f.changed(moved);
  const noAttached = await f.doc();
  assert.deepEqual(noAttached.drawing.frames, [standalone]);
  await dimRow.getByRole('button', { name: /^Remove dimension / }).click();
  await f.changed(noAttached);
  const frameOnly = await f.doc();
  assert.deepEqual(frameOnly.drawing.dimensions, [control, otherDetail]);
  await refuse('B', 'standalone-frame-protects-detail');
  await button('Remove standalone frame 1').click();
  await f.changed(frameOnly);
  const unbound = await f.doc();
  assert.equal(unbound.drawing.frames, undefined);

  f.phase = 'remove unbound B and restore it once';
  await button('Remove detail B').click();
  await f.changed(unbound);
  const removed = await f.doc();
  assert.deepEqual(removed.drawing.details, [detailC]);
  assert.deepEqual(removed.drawing.sheets, [{ id: 's2', views: [] }]);
  assert.deepEqual(removed.drawing.dimensions, [control, otherDetail]);
  await f.undo();
  await f.same(unbound);
  await f.page.locator(`${svg} g.detail[data-view="detail:B"]`).waitFor();
  await f.redo();
  await f.same(removed);
  checkGeometry(removed);
  await exportSvg('split-empty', {}, {});
  const saved = await save('removed');
  await open(saved.file);
  await f.same(saved.doc);
  const replacement = await addDetail('top', 32, 16, 7);
  assert.equal(replacement.id, 'B');
  assert.deepEqual((await f.doc()).drawing.sheets, [{ id: 's2', views: [] }]);
  await exportSvg('fresh-reuse', { B: 5, C: 5 }, topAndC);
  await f.snapshot('fresh-reuse');

  f.phase = 'legacy unresolved detail references';
  await open(files.get('legacy-detail'));
  const legacy = await f.doc();
  await checkLost('b-diameter');
  assert.deepEqual(legacy.drawing.frames, [attached, standalone]);
  const sameEdge = await addDetail('top', 32, 16, 7);
  assert.equal(sameEdge.id, 'D');
  await checkLost('b-diameter');
  const differentView = await addDetail('front', 8, 2, 4);
  assert.equal(differentView.id, 'F');
  const differentCrop = await addDetail('top', 8, 2, 4);
  assert.equal(differentCrop.id, 'G');
  await checkLost('b-diameter');
  const after = await f.doc();
  assert.deepEqual(after.drawing.dimensions, legacy.drawing.dimensions);
  assert.deepEqual(after.drawing.frames, legacy.drawing.frames);
  assert.deepEqual(after.drawing.sheets, legacy.drawing.sheets);
  checkGeometry(after);
  const legacySaved = await save('legacy-updated');
  await open(legacySaved.file);
  await f.same(legacySaved.doc);
  await checkLost('b-diameter');
  await exportSvg('legacy-reopened', { C: 5, D: 5, F: null, G: null }, topAndC);
  await f.snapshot('legacy-reopened');
  assert.deepEqual(f.report.downloads, []);
});
