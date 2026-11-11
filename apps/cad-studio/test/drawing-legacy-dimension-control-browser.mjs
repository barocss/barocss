// D755/D756: legacy controls with more than one matching dimension.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const stored = mode === '--stored' || mode === '--stored-baseline';
const baseline = mode === '--baseline' || mode === '--stored-baseline';
const frameIssue = 'The position frame on dimension d1 is hidden because the ID is shared. The saved frame is retained.';
const fixturePath = 'packages/barocss-cad/conformance/r14/orient-cross-hole-y-plus/case.json';
const { input } = JSON.parse(await readFile(fixturePath, 'utf8'));
const top = {
  id: 'd1', view: 'top', kind: 'linear', orient: 'vertical', place: [-10, 15],
  a: { edge: 'n1.bottom|n1.side0', at: 'end', near: [0, 0, 0] },
  b: { edge: 'n1.bottom|n1.side2', at: 'end', near: [0, 30, 0] },
};
const right = {
  id: 'd1', view: 'right', kind: 'diameter', edge: 'n1.side1|n2.side0#2',
  near: [60, 15, 15], place: [35, 30],
};
const title = 'Legacy dimension control';
const fixture = { ...input.document, drawing: {
  sheet: 'A4', projection: 'third', hidden: true, title,
  views: ['front', 'top', 'right', 'iso'], dimensions: [top, right],
  ...(stored ? { frames: [{ id: 'control-d1', dim: 'd1', characteristic: 'position', value: 0.1, datums: [] }] } : {}),
  sheets: [{ id: 'S2', name: 'Continuation', size: 'A3', scale: 1, views: ['right'] }],
} };
const pins = [
  'apps/cad-studio/test/drawing-legacy-dimension-control-browser.mjs',
  'apps/cad-studio/src/ui/DrawingWorkspace.tsx', 'apps/cad-studio/src/ui/drawing/FrameEditor.tsx',
  'packages/barocss-cad-model/src/drawing/sheets.ts', fixturePath,
  ...(stored ? [
    'packages/barocss-cad-model/src/drawing/sheet.ts', 'packages/barocss-cad-model/src/drawing/issues.ts',
    'packages/barocss-cad-model/src/drawing/annotations3d.ts',
  ] : []),
];
const f = await createFlow({
  name: 'drawing-legacy-dimension-control', output, envFrozen: stored ? 'D756_SOURCE_FROZEN' : 'D755_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: stored ? 'Resolve a saved frame only when its dimension ID is unique' : baseline ? 'Reproduce cross-sheet frame attachment' : 'Require a unique dimension before attaching a control frame',
  limits: ['Two desktop sheets, one legacy duplicate and one attached position frame. Native local project storage.'],
  snapshotExtra: () => ({
    dimensions: window.__studioDrawing?.()?.dimensions ?? [],
    frames: [...document.querySelectorAll('svg[aria-label="Drawing sheet"] g.control')].map(g => ({
      id: g.getAttribute('data-dim'), text: g.textContent,
    })),
    hint: document.querySelector('.dw-hint')?.textContent ?? null,
    frameAnnotations: window.__studioAnnotations?.()?.items.filter(item => item.kind === 'frame') ?? [],
    annotationOmissions: window.__studioAnnotations?.()?.left ?? [],
    historyActions: ['Undo', 'Redo'].map(label => document.querySelector('button[aria-label="' + label + '"]')?.disabled),
  }),
  oracleSource: String.raw`
import json, sys, xml.etree.ElementTree as ET
report = json.load(sys.stdin)
root = ET.fromstring(report["svg"])
ns = {"s": "http://www.w3.org/2000/svg"}
dims = root.findall(".//s:g[@class='dimension'][@data-dim='d1']", ns)
assert len(dims) == 1 and "".join(dims[0].itertext()).strip() == report["dimension"], dims
controls = root.findall(".//s:g[@class='control'][@data-dim='control-d1']", ns)
assert len(controls) == report["count"], controls
if controls:
    assert "".join(controls[0].itertext()).strip() == "Ø0.1"
print(json.dumps({"status": "PASS", "dimension": report["dimension"], "controls": len(controls)}))
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
    window.__legacyControlSvg = blob.text();
    blobs.delete(this.href);
  };
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    if (stored) await context.addInitScript(captureSvg);
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
  const frame = page.locator('svg[aria-label="Drawing sheet"] g.control[data-dim="control-d1"]');
  const refusal = 'Dimension d1 has a duplicate ID. Remove the duplicate dimension before changing its geometric control.';
  const selectSheet = async (name, text) => {
    const tab = page.getByRole('tab', { name, exact: true });
    await tab.click();
    assert.equal(await tab.getAttribute('aria-selected'), 'true');
    await page.waitForFunction(text => window.__studioDrawing?.()?.dimensions.some(d => d.text === text), text);
  };
  const selectDimension = view => page.locator('.dw-dim').filter({ hasText: '· ' + view }).click();
  const addControl = () => button('Add geometric control').click();
  const file = 'legacy-dimension-control.bcad', bytes = Buffer.from(JSON.stringify(fixture));

  f.phase = 'Open the original dimensions with the shared ID';
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
  await page.waitForFunction(title => window.__studioDoc?.drawing?.title === title, title);
  await f.ready();
  f.report.observations.push({ sourceSHA256: sha256(bytes) });
  await modeButton('Drawing').click();
  await selectSheet('Sheet 1', '30');
  if (stored) {
    f.phase = 'Read the stored frame in the continuation sheet and actual SVG';
    const original = await f.doc();
    assert.deepEqual(original.drawing.frames, fixture.drawing.frames);
    assert.equal(await frame.count(), 0);
    await selectSheet('Continuation', 'Ø8 THRU');
    if (baseline) await frame.waitFor();
    else await page.getByText(frameIssue, { exact: true }).waitFor();
    const continuation = await f.snapshot('stored-control-continuation');
    assert.deepEqual(continuation.doc, original);
    assert.deepEqual(continuation.frames, baseline ? [{ id: 'control-d1', text: 'Ø0.1' }] : []);
    assert.deepEqual(continuation.frameAnnotations.map(item => item.id), baseline ? ['control-d1'] : []);
    if (!baseline) assert.ok(continuation.annotationOmissions.some(item => item.id === 'control-d1' && item.why === frameIssue));
    const checkSvg = async (label, dimension, count) => {
      await page.evaluate(() => { window.__legacyControlSvg = null; });
      await button('Export SVG').click();
      await page.waitForFunction(() => window.__legacyControlSvg);
      const svg = await page.evaluate(() => window.__legacyControlSvg);
      f.report.files.push({ label, sha256: sha256(svg) });
      await f.runOracle({ svg, dimension, count }, label);
    };
    await checkSvg('stored-continuation-svg', 'Ø8 THRU', baseline ? 1 : 0);
    if (baseline) return;

    f.phase = 'Resolve the duplicate explicitly and verify display without rewriting the frame';
    await button('Remove dimension Ø8 THRU').click();
    await f.changed(original);
    const resolved = await f.doc();
    assert.deepEqual(resolved.drawing.frames, original.drawing.frames);
    assert.deepEqual(resolved.drawing.dimensions, [original.drawing.dimensions[0]]);
    await selectSheet('Sheet 1', '30');
    await frame.waitFor();
    const restored = await f.snapshot('stored-control-on-unique-top-dimension');
    assert.deepEqual(restored.frameAnnotations.map(item => item.id), ['control-d1']);
    assert.deepEqual(restored.frames, [{ id: 'control-d1', text: 'Ø0.1' }]);
    await checkSvg('unique-top-svg', '30', 1);
    await button('Undo').click();
    await f.same(original);
    await selectSheet('Continuation', 'Ø8 THRU');
    await page.getByText(frameIssue, { exact: true }).waitFor();
    assert.equal(await frame.count(), 0);
    await button('Redo').click();
    await f.same(resolved);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  await selectDimension('top');
  const before = await f.snapshot('legacy-top-dimension');
  assert.deepEqual(before.doc.drawing.dimensions.map(d => [d.id, d.view]), [['d1', 'top'], ['d1', 'right']]);
  assert.deepEqual(before.frames, []);
  assert.deepEqual(before.dimensions.map(d => d.value), [30]);

  f.phase = 'Add a position control from the first sheet';
  await addControl();
  if (baseline) {
    await f.changed(before.doc);
    const first = await f.snapshot('baseline-control-missing-from-selected-top');
    assert.equal(first.doc.drawing.frames[0].dim, 'd1');
    assert.deepEqual(first.frames, []);
    await selectSheet('Continuation', 'Ø8 THRU');
    await frame.waitFor();
    const second = await f.snapshot('baseline-control-on-continuation-diameter');
    assert.equal(second.dimensions.length, 1);
    assert.ok(Math.abs(second.dimensions[0].value - 8) < 1e-12);
    assert.deepEqual(second.frames, [{ id: 'control-d1', text: 'Ø0.1' }]);
    return;
  }
  const refused = async label => {
    await page.getByText(refusal, { exact: true }).waitFor();
    await f.same(before.doc);
    const state = await f.snapshot(label);
    assert.deepEqual(state.history, before.history);
    assert.deepEqual(state.historyActions, before.historyActions);
    assert.deepEqual(state.frames, []);
    assert.equal(await page.locator('.dw-dim.sel').count(), 1);
  };
  await refused('top-ambiguous-control-refused');
  await selectSheet('Continuation', 'Ø8 THRU');
  await selectDimension('right');
  await addControl();
  await refused('right-ambiguous-control-refused');

  f.phase = 'Remove the duplicate explicitly and add to the exact remaining dimension';
  await button('Remove dimension Ø8 THRU').click();
  await f.changed(before.doc);
  const removed = await f.doc();
  assert.deepEqual(removed.drawing.dimensions, [before.doc.drawing.dimensions[0]]);
  await button('Undo').click();
  await f.same(before.doc);
  await button('Redo').click();
  await f.same(removed);
  await selectSheet('Sheet 1', '30');
  await selectDimension('top');
  await addControl();
  await f.changed(removed);
  await frame.waitFor();
  const applied = await f.snapshot('control-on-exact-top-dimension');
  assert.deepEqual(applied.doc.drawing.frames, [{ id: 'control-d1', dim: 'd1', characteristic: 'position', value: 0.1, datums: [] }]);
  assert.deepEqual(applied.frames, [{ id: 'control-d1', text: 'Ø0.1' }]);
  assert.ok(!applied.hint.includes('duplicate ID'));
  await button('Undo').click();
  await f.same(removed);
  await button('Redo').click();
  await f.same(applied.doc);

  f.phase = 'Save and reopen the unambiguous control in a fresh page';
  const project = 'D755 legacy dimension control';
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
  assert.deepEqual(JSON.parse(saved), applied.doc);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await panel().getByRole('button', { name: 'Close project', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await f.ready();
  await attach();
  await panel().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(applied.doc);
  await modeButton('Drawing').click();
  await selectSheet('Sheet 1', '30');
  await frame.waitFor();
  const opened = await f.snapshot('fresh-open-top-control');
  assert.deepEqual(opened.frames, applied.frames);
  assert.deepEqual(f.report.downloads, []);
});
