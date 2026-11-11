// D733: actual desktop Add drawing for DXF profile height fields.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/dxf-profile-height-browser.mjs',
  'apps/cad-studio/src/state/useSpecificationActions.ts',
  'packages/barocss-cad-model/src/sketch/dxfRead.ts',
  'packages/barocss-cad-model/src/sketch/dxfUnderlay.ts',
];
const f = await createFlow({
  name: 'dxf-profile-height', output, envFrozen: 'D733_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce loss of DXF endpoint Z and elevation' : 'Preserve the XY profile admission boundary',
  limits: ['Authored ASCII DXF coordinates and actual desktop Studio Add drawing.'],
  inspectorSource: `
import { runDraftTool } from '@barocss/cad-model/chat/drafts';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { readDxfSketch } from '@barocss/cad-model/sketch/dxfRead';
const { text, name } = JSON.parse(process.argv[3]);
let area, box, error, volume;
try {
  const result = readDxfSketch(text);
  area = result.regions[0].area;
  box = result.regions[0].box;
} catch (cause) { error = cause.message; }
const draft = runDraftTool(emptyDoc(), 'import_drawing', { dxf: text, name });
if ('doc' in draft) {
  const solid = evaluatePart(withNode(draft.doc, { kind: 'extrude', sketch: 0, height: 3 }), 1);
  if (!solid.ok) throw new Error(solid.error.detail);
  volume = solid.bodies[0].volume;
}
console.log(JSON.stringify({ area, box, error, toolError: draft.error, volume }));
`,
});

const corners = [[0, 0], [20, 0], [20, 10], [0, 10]];
function lines(start, end) {
  return corners.flatMap(([x, y], i) => {
    const [xx, yy] = corners[(i + 1) % corners.length];
    return [0, 'LINE', 10, x, 20, y, ...(i === 0 && start !== undefined ? [30, start] : []),
      11, xx, 21, yy, ...(i === 0 && end !== undefined ? [31, end] : [])];
  });
}
const polyline = elevation => [0, 'LWPOLYLINE', 90, 4, 70, 1, ...(elevation === undefined ? [] : [38, elevation]),
  ...corners.flatMap(([x, y]) => [10, x, 20, y])];
function drawing(entities) {
  return [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC',
    0, 'SECTION', 2, 'ENTITIES', ...entities, 0, 'ENDSEC', 0, 'EOF', ''].join('\n');
}
const cases = [
  ['line-start-only', lines(5, 0), 'LINE', 30, 'DXF_UNSUPPORTED', false],
  ['line-end-only', lines(0, 5), 'LINE', 31, 'DXF_UNSUPPORTED', true],
  ['line-both-ends', lines(5, 5), 'LINE', 30, 'DXF_UNSUPPORTED', false],
  ['elevation-positive', polyline(5), 'LWPOLYLINE', 38, 'DXF_UNSUPPORTED', true],
  ['elevation-negative', polyline(-5), 'LWPOLYLINE', 38, 'DXF_UNSUPPORTED', true],
  ['malformed-endpoint', lines(0, 'NaN'), 'LINE', 31, 'DXF_MALFORMED', true],
  ['malformed-elevation', polyline('1e309'), 'LWPOLYLINE', 38, 'DXF_MALFORMED', true],
];

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const createContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await createContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return ['http:', 'https:'].includes(url.protocol) && url.origin !== origin ? route.abort() : route.continue();
    });
    return context;
  };
  await f.newPage();
  let page = f.page;
  const button = name => page.getByRole('button', { name, exact: true });
  const dirty = () => page.getByLabel('Unsaved changes', { exact: true }).count();
  const add = async (name, text) => {
    const file = join(output, name + '.dxf');
    await writeFile(file, text);
    await page.getByLabel('Add drawing', { exact: true }).setInputFiles(file);
  };
  const inspect = (name, text) => f.inspect(name, {}, { text, name });
  const newPart = async () => {
    await button('New part').click();
    await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.ready();
  };
  await newPart();
  const blank = await f.doc();
  let accepted, acceptedDirty, redo;
  if (!baseline) {
    await add('accepted-xy', drawing(lines(0, 0)));
    await f.waitToast(/Drawing added as a draft/);
    await f.changed(blank);
    const sourceSketch = await f.doc();
    await button('Top').click();
    await f.frame([[0, 0], [20, 10]]);
    await f.worldClick([4, 4]);
    await f.openExtrudeHud();
    const current = await f.applyExtrude({ distance: 3, previous: sourceSketch, label: 'accepted-xy' });
    const width = page.getByRole('spinbutton', { name: 'F1.width value', exact: true });
    await width.fill('24');
    await width.press('Enter');
    await page.waitForFunction(() => window.__studioDoc.drafts.drafts[0].dims[0].value === 24);
    await f.undo();
    await f.same(current.doc);
    const [x, y] = await page.evaluate(() => window.__studioScreenOf([4, 4, 3]));
    await page.mouse.click(x, y);
    await page.waitForFunction(() => window.__studioSelection.selection.faces.length === 1);
    accepted = await f.snapshot('accepted-xy-with-selected-face');
    acceptedDirty = await dirty();
    assert.equal(await button('Redo').isEnabled(), true);
    redo = await button('Redo').getAttribute('data-tip');
    await f.dismissToasts();
  }
  for (const [name, entities, type, field, code, parentAccepted] of cases) {
    f.phase = 'Import ' + name;
    const text = drawing(entities), result = await inspect(name, text);
    await add(name, text);
    if (baseline && parentAccepted) {
      await f.waitToast(/Drawing added as a draft/);
      await f.changed(blank);
      assert.equal(result.area, 200);
      assert.deepEqual(result.box, [0, 0, 20, 10]);
      assert.ok(Math.abs(result.volume - 600) < 1e-7);
      await f.snapshot(name + '-parent-accepted');
      await f.undo();
      await f.same(blank);
    } else {
      assert.equal(result.toolError, result.error);
      assert.ok(result.error.startsWith('[' + code + ']'));
      const toast = await f.waitToast(/Could not read this drawing/);
      assert.match(toast, new RegExp(type));
      if (!baseline) assert.match(toast, new RegExp('group ' + field + '\\b'));
      const refused = await f.snapshot(name + '-refused');
      assert.deepEqual(refused.doc, baseline ? blank : accepted.doc);
      if (!baseline) {
        assert.deepEqual(refused.bodies, accepted.bodies);
        assert.deepEqual(refused.selection, accepted.selection);
        assert.deepEqual(refused.history, accepted.history);
        assert.equal(await dirty(), acceptedDirty);
        assert.equal(await button('Redo').isEnabled(), true);
        assert.equal(await button('Redo').getAttribute('data-tip'), redo);
      }
    }
    f.report.observations.push({ name, sha256: sha256(text), ...result });
    await f.dismissToasts();
  }
  if (baseline) return;

  f.phase = 'Retry with a zero-elevation closed profile and extrude at 3 mm';
  await newPart();
  await add('zero-elevation', drawing(polyline(0)));
  await f.waitToast(/Drawing added as a draft/);
  const sketch = await f.snapshot('accepted-zero-elevation');
  await button('Top').click();
  await f.frame([[0, 0], [20, 10]]);
  await f.worldClick([4, 4]);
  await f.openExtrudeHud();
  const part = await f.applyExtrude({ distance: 3, previous: sketch.doc, label: 'zero-elevation' });
  assert.ok(Math.abs(part.bodies.bodies[0].volume - 600) < 1e-7);
  await f.undo();
  await f.same(sketch.doc);
  await f.redo();
  await f.same(part.doc);

  f.phase = 'Save and fresh-open the accepted zero-elevation solid';
  const project = 'D733 DXF profile', savedName = 'profile-study.bcad';
  await page.locator('.doc-tab input').fill('profile-study');
  await button('Project and versions').click();
  const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(savedName, { exact: true }).waitFor();
  const saved = await page.evaluate(async ({ project, savedName }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(savedName)).getFile()).text();
  }, { project, savedName });
  assert.deepEqual(JSON.parse(saved), part.doc);
  const path = join(output, savedName);
  await writeFile(path, saved);
  await f.newPage();
  page = f.page;
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(path);
  await f.same(part.doc);
  const fresh = await f.snapshot('fresh-zero-elevation-solid');
  assert.deepEqual(fresh.bodies.bodies, part.bodies.bodies);
  f.report.observations.push({ nativeSHA256: sha256(saved), volume: fresh.bodies.bodies[0].volume });
  assert.deepEqual(f.report.downloads, []);
});
