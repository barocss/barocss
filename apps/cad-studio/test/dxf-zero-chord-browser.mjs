// D731: actual desktop import, refusal state, and native Save/Open for DXF bulges.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/dxf-zero-chord-browser.mjs',
  'apps/cad-studio/src/state/useSpecificationActions.ts',
  'packages/barocss-cad-model/src/sketch/dxfRead.ts',
  'packages/barocss-cad-model/src/sketch/dxfUnderlay.ts',
  ...(!baseline ? ['packages/barocss-cad-model/src/sketch/dxfBulge.ts'] : []),
];
const f = await createFlow({
  name: 'dxf-zero-chord', output, envFrozen: 'D731_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce admission of nonfinite DXF bulges' : 'Refuse malformed bulges and preserve the accepted part',
  limits: ['Self-authored ASCII DXF groups, desktop Add drawing, and native Save/Open.'],
  inspectorSource: `
import { readDxfSketch } from '@barocss/cad-model/sketch/dxfRead';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { runDraftTool } from '@barocss/cad-model/chat/drafts';
const { text, name } = JSON.parse(process.argv[3]);
const nonfinite = value => typeof value === 'number' ? Number(!Number.isFinite(value))
  : value && typeof value === 'object' ? Object.values(value).reduce((n, child) => n + nonfinite(child), 0) : 0;
let result;
try {
  const read = readDxfSketch(text);
  result = { nonfinite: nonfinite(read), area: read.regions[0]?.area, hole: read.holes[0]?.area, counts: read.underlay.counts };
} catch (error) { result = { error: error.message }; }
const tool = runDraftTool(emptyDoc(), 'import_drawing', { dxf: text, name });
result.draft = 'error' in tool ? tool.error : nonfinite(tool.doc);
console.log(JSON.stringify(result));
`,
});

function polyline(type, vertices, closed = false) {
  if (type === 'LWPOLYLINE') {
    return [0, type, 90, vertices.length, 70, +closed, ...vertices.flatMap(([x, y, bulge = 0]) => [10, x, 20, y, 42, bulge])];
  }
  return [0, type, 66, 1, 70, +closed, ...vertices.flatMap(([x, y, bulge = 0]) => [0, 'VERTEX', 10, x, 20, y, 42, bulge]), 0, 'SEQEND'];
}
const outline = polyline('LWPOLYLINE', [[0, 0], [20, 0], [20, 0], [20, 10], [0, 10]], true);
function drawing(entities, block) {
  const blocks = block ? [0, 'SECTION', 2, 'BLOCKS', 0, 'BLOCK', 2, 'DETAIL', 70, 0, 10, 0, 20, 0, ...block, 0, 'ENDBLK', 0, 'ENDSEC'] : [];
  const insert = block ? [0, 'INSERT', 2, 'DETAIL', 10, 2, 20, 2] : [];
  return [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC', ...blocks,
    0, 'SECTION', 2, 'ENTITIES', ...entities, ...insert, 0, 'ENDSEC', 0, 'EOF', ''].join('\n');
}
const underlayLine = [0, 'LINE', 10, 0, 20, 0, 11, 4, 21, 0];
const lw = polyline('LWPOLYLINE', [[30, 5, 1], [30, 5]]);
const r12 = polyline('POLYLINE', [[30, 5, -1], [30, 5]]);
const cases = [
  ['lw-profile-only', drawing(lw), 'LWPOLYLINE'],
  ['r12-beside-outline', drawing([...outline, ...r12]), 'POLYLINE'],
  ['lw-block-only', drawing([], lw), 'LWPOLYLINE'],
  ['r12-block-beside-outline', drawing(outline, r12), 'POLYLINE'],
];
const acceptedDrawing = drawing(outline, underlayLine);
const control = drawing([...outline, ...polyline('LWPOLYLINE', [[12, 5, 1], [8, 5, 1]], true)], underlayLine);
const expectedVolume = 600 - 12 * Math.PI;

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
  const readNonfinite = () => page.evaluate(() => {
    const nonfinite = value => typeof value === 'number' ? Number(!Number.isFinite(value))
      : value && typeof value === 'object' ? Object.values(value).reduce((n, child) => n + nonfinite(child), 0) : 0;
    return nonfinite(window.__studioDoc);
  });
  await button('New part').click();
  await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const blank = await f.doc();
  let accepted, redo, acceptedDirty;
  if (!baseline) {
    await add('accepted-existing-draft', acceptedDrawing);
    await f.waitToast(/Drawing added as a draft/);
    await f.changed(blank);
    accepted = await f.snapshot('existing-draft-and-underlay');
    assert.deepEqual(accepted.doc.underlays[0].polylines, [[[2, 2], [6, 2]]]);
    const width = page.getByRole('spinbutton', { name: 'F1.width value', exact: true });
    await width.fill('24');
    await width.press('Enter');
    await page.waitForFunction(() => window.__studioDoc.drafts.drafts[0].dims[0].value === 24);
    await f.undo();
    await f.same(accepted.doc);
    assert.equal(await button('Redo').isEnabled(), true);
    redo = await button('Redo').getAttribute('data-tip');
    acceptedDirty = await dirty();
    await f.dismissToasts();
  }

  for (const [name, text, kind] of cases) {
    f.phase = 'Import ' + name;
    const result = await inspect(name, text);
    const viewportError = baseline && name.includes('-block-')
      ? page.waitForEvent('pageerror', { predicate: error => /GEOMETRY_INVALID.*not finite/.test(error.message), timeout: 15000 })
      : null;
    await add(name, text);
    if (baseline) {
      assert.ok(result.nonfinite > 0 && result.draft > 0, JSON.stringify(result));
      if (viewportError) await viewportError;
      else await f.waitToast(/Drawing added as a draft/);
      assert.ok(await readNonfinite() > 0);
      await f.snapshot(name + '-parent-accepted');
      await f.newPage();
      page = f.page;
      await button('New part').click();
      await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
      await f.ready();
    } else {
      assert.match(result.error, /^\[DXF_MALFORMED\].*bulge.*coincident/i);
      assert.equal(result.draft, result.error);
      const toast = await f.waitToast(/Could not read this drawing/);
      assert.match(toast, new RegExp('\\b' + kind + '\\b'));
      assert.match(toast, /bulge.*coincident/i);
      const refused = await f.snapshot(name + '-refused');
      assert.deepEqual(refused.doc, accepted.doc);
      assert.deepEqual(refused.bodies, accepted.bodies);
      assert.deepEqual(refused.history, accepted.history);
      assert.equal(await button('Redo').isEnabled(), true);
      assert.equal(await button('Redo').getAttribute('data-tip'), redo);
      assert.equal(await dirty(), acceptedDirty);
      assert.equal(await readNonfinite(), 0);
    }
    f.report.observations.push({ name, sha256: sha256(text), ...result });
    if (!baseline) await f.dismissToasts();
  }
  if (baseline) return;

  f.phase = 'Import the valid two-bulge hole and extrude 3 mm';
  await button('New part').click();
  await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const valid = await inspect('positive-chord', control);
  assert.equal(valid.nonfinite, 0);
  assert.equal(valid.area, 200);
  assert.ok(Math.abs(valid.hole - 4 * Math.PI) < 1e-8);
  await add('positive-chord', control);
  await f.waitToast(/Drawing added as a draft/);
  const sketch = await f.snapshot('valid-bulged-hole');
  assert.equal(sketch.doc.nodes[0].holes.length, 1);
  await button('Top').click();
  await f.frame([[0, 0], [20, 10]]);
  await f.worldClick([4, 4]);
  await f.openExtrudeHud();
  const part = await f.applyExtrude({ distance: 3, previous: sketch.doc, label: 'valid-bulged-hole' });
  assert.ok(Math.abs(part.bodies.bodies[0].volume - expectedVolume) < 1e-7);
  await f.undo();
  await f.same(sketch.doc);
  await f.redo();
  await f.same(part.doc);

  f.phase = 'Save and fresh-open the accepted part';
  const project = 'D731 DXF bulges', savedName = 'bulge-study.bcad';
  await page.locator('.doc-tab input').fill('bulge-study');
  await button('Project and versions').click();
  const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(savedName, { exact: true }).waitFor();
  await page.getByLabel('Unsaved changes', { exact: true }).waitFor({ state: 'detached' });
  const native = await page.evaluate(async ({ project, savedName }) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(savedName)).getFile()).text();
  }, { project, savedName });
  assert.deepEqual(JSON.parse(native), part.doc);
  const path = join(output, savedName);
  await writeFile(path, native);
  await f.newPage();
  page = f.page;
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles(path);
  await f.same(part.doc);
  const fresh = await f.snapshot('fresh-valid-bulged-hole');
  assert.deepEqual(fresh.bodies.bodies, part.bodies.bodies);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ controlSHA256: sha256(control), nativeSHA256: sha256(native), expectedVolume });
});
