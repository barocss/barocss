// D730: exercise visibility-bearing ASCII DXF through desktop Studio Add drawing.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/dxf-visibility-browser.mjs',
  'apps/cad-studio/src/state/useSpecificationActions.ts',
  'packages/barocss-cad-model/src/sketch/dxfRead.ts',
  'packages/barocss-cad-model/src/sketch/dxfUnderlay.ts',
  ...(!baseline ? ['packages/barocss-cad-model/src/sketch/dxfVisibility.ts'] : []),
];
const f = await createFlow({
  name: 'dxf-visibility', output, envFrozen: 'D730_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce silent admission of hidden DXF entities' : 'Refuse hidden DXF geometry and preserve the accepted Studio part',
  limits: ['Self-authored ASCII DXF groups and actual Studio Drafts.'],
  inspectorSource: `
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { runDraftTool } from '@barocss/cad-model/chat/drafts';
import { readDxfSketch } from '@barocss/cad-model/sketch/dxfRead';
const { text, name } = JSON.parse(process.argv[3]);
const host = emptyDoc();
let sketch, error, volume;
try {
  sketch = readDxfSketch(text);
  const draft = runDraftTool(host, 'import_drawing', { dxf: text, name });
  if ('doc' in draft && draft.doc.nodes.length) {
    const part = withNode(draft.doc, { kind: 'extrude', sketch: 0, height: 3 });
    const result = evaluatePart(part, 1);
    if (!result.ok) throw new Error(result.error.detail);
    volume = result.bodies[0].volume;
  }
} catch (cause) { error = cause.message; }
console.log(JSON.stringify({ sketch, error, volume }));
`,
});

const layer = (name, flags, color, plot = 1) => [0,'LAYER',2,name,70,flags,62,color,6,'CONTINUOUS',290,plot];
function drawing({ flags = 0, color = 7, plot = 1, use = 'circle', invisible = false } = {}) {
  const outline = [0,'LWPOLYLINE',8,'OUTLINE',90,4,70,1,10,0,20,0,10,20,20,0,10,20,20,10,10,0,20,10];
  const note = [0,'TEXT',8,'DETAILS',10,2,20,2,40,1,1,'Hidden note'];
  const ellipse = [0,'ELLIPSE',8,'DETAILS',10,10,20,5,11,2,21,0,40,0.5,41,0,42,2 * Math.PI];
  const circle = [0,'CIRCLE',8,'DETAILS',10,10,20,5,30,0,40,2,...(invisible ? [60,1] : [])];
  const insert = [0,'INSERT',8,'DETAILS',2,'NOTE',10,2,20,2];
  const blocks = [0,'SECTION',2,'BLOCKS',0,'BLOCK',8,'0',2,'NOTE',70,0,10,0,20,0,
    0,'LINE',8,'0',10,0,20,0,11,2,21,0,0,'ENDBLK',0,'ENDSEC'];
  const extra = { circle, note, ellipse, insert, none: [] }[use];
  return [0,'SECTION',2,'HEADER',9,'$INSUNITS',70,4,0,'ENDSEC',
    0,'SECTION',2,'TABLES',0,'TABLE',2,'LAYER',70,3,
    ...layer('0',0,7),...layer('OUTLINE',0,7),...layer('DETAILS',flags,color,plot),0,'ENDTAB',0,'ENDSEC',
    ...(use === 'insert' ? blocks : []),0,'SECTION',2,'ENTITIES',...outline,...extra,0,'ENDSEC',0,'EOF',''].join('\n');
}

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
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
  const add = async (name, text) => {
    const path = join(output, name + '.dxf');
    await writeFile(path, text);
    await page.getByLabel('Add drawing', { exact: true }).setInputFiles(path);
  };
  const inspect = (name, text) => f.inspect(name, {}, { text, name });
  await button('New part').click();
  await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const blank = await f.doc();
  const cases = [
    ['off', { color: -7 }, 'CIRCLE', 'off'],
    ['frozen', { flags: 1 }, 'CIRCLE', 'frozen'],
    ['invisible', { invisible: true }, 'CIRCLE', 'invisible'],
    ['off-note', { color: -7, use: 'note' }, 'TEXT', 'off'],
    ['frozen-ellipse', { flags: 1, use: 'ellipse' }, 'ELLIPSE', 'frozen'],
    ['off-insert', { color: -7, use: 'insert' }, 'INSERT', 'off'],
  ];

  let accepted, redo;
  if (!baseline) {
    await add('unused-off-layer', drawing({ color: -7, use: 'none' }));
    await f.waitToast(/Drawing added as a draft/);
    await f.changed(blank);
    accepted = await f.snapshot('visible-profile-accepted');
    assert.equal(accepted.doc.nodes[0].holes, undefined);
    const width = page.getByRole('spinbutton', { name: 'F1.width value', exact: true });
    await width.fill('25');
    await width.press('Enter');
    await page.waitForFunction(() => window.__studioDoc.drafts.drafts[0].dims[0].value === 25);
    await f.undo();
    await f.same(accepted.doc);
    redo = await button('Redo').getAttribute('data-tip');
    assert.equal(await button('Redo').isEnabled(), true);
    await f.dismissToasts();
  }
  for (const [name, options, type, reason] of cases) {
    f.phase = 'Import ' + name;
    const text = drawing(options), result = await inspect(name, text);
    await add(name, text);
    if (baseline) {
      await f.waitToast(/Drawing added as a draft/);
      await f.changed(blank);
      const state = await f.snapshot(name + '-parent-accepted');
      if (type === 'CIRCLE') {
        assert.equal(result.sketch.holes.length, 1);
        assert.equal(state.doc.nodes[0].holes.length, 1);
        assert.ok(Math.abs(result.volume - (600 - 12 * Math.PI)) < 1e-7);
      } else {
        assert.deepEqual(state.doc.underlays[0].counts, { [type === 'INSERT' ? 'LINE' : type]: 1 });
      }
      await f.undo();
      await f.same(blank);
    } else {
      assert.match(result.error, /^\[DXF_UNSUPPORTED\]/);
      const notice = await f.waitToast(/Could not read this drawing/);
      assert.match(notice, new RegExp(reason, 'i'));
      assert.match(notice, new RegExp(type));
      assert.match(notice, /DETAILS/);
      const refused = await f.snapshot(name + '-refused');
      assert.deepEqual(refused.doc, accepted.doc);
      assert.deepEqual(refused.history, accepted.history);
      assert.deepEqual(refused.bodies.bodies, accepted.bodies.bodies);
      assert.equal(await button('Redo').isEnabled(), true);
      assert.equal(await button('Redo').getAttribute('data-tip'), redo);
    }
    f.report.observations.push({ name, sha256: sha256(text), volume: result.volume ?? null, error: result.error ?? null });
    await f.dismissToasts();
  }
  if (baseline) return;

  f.phase = 'Retry with visible locked and nonplot geometry and extrude at 3 mm';
  await button('New part').click();
  await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
  await f.ready();
  const normal = drawing({ flags: 2 | 4, plot: 0 });
  const result = await inspect('visible-locked-nonplot', normal);
  assert.equal(result.sketch.regions[0].area, 200);
  assert.ok(Math.abs(result.sketch.holes[0].area - 4 * Math.PI) < 1e-8);
  await add('visible-locked-nonplot', normal);
  await f.waitToast(/Drawing added as a draft/);
  const sketch = await f.snapshot('visible-locked-nonplot');
  assert.equal(sketch.doc.nodes[0].holes.length, 1);
  await button('Top').click();
  await f.frame([[0, 0], [20, 10]]);
  await f.worldClick([4, 4]);
  await f.openExtrudeHud();
  const part = await f.applyExtrude({ distance: 3, previous: sketch.doc, label: 'visible-dxf' });
  assert.ok(Math.abs(part.bodies.bodies[0].volume - (600 - 12 * Math.PI)) < 1e-7);
  await f.undo();
  await f.same(sketch.doc);
  await f.redo();
  await f.same(part.doc);

  f.phase = 'Save the accepted draft and solid and open the saved bytes in a new context';
  const project = 'D730 DXF visibility', savedName = 'visibility-study.bcad';
  await page.locator('.doc-tab input').fill('visibility-study');
  await button('Project and versions').click();
  const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(savedName, { exact: true }).waitFor();
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
  const fresh = await f.snapshot('fresh-visible-dxf');
  assert.deepEqual(fresh.bodies.bodies, part.bodies.bodies);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ nativeSHA256: sha256(native) });
});
