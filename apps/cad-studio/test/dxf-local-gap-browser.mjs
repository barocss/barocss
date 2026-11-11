// D725: import self-authored line groups through desktop Studio Drafts.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/dxf-local-gap-browser.mjs',
  'apps/cad-studio/src/state/useSpecificationActions.ts',
  'apps/cad-studio/src/ui/DraftsPanel.tsx',
  'packages/barocss-cad-model/src/sketch/dxfRead.ts',
  'packages/barocss-cad-model/src/chat/drafts.ts',
];
const f = await createFlow({
  name: 'dxf-local-gap', output, envFrozen: 'D725_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce location-dependent DXF closure in Studio' : 'Preserve a physical endpoint gap through translation and unrelated geometry',
  limits: ['Self-authored planar line groups, one unrelated circle and the actual Add drawing path.'],
  inspectorSource: `
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { runDraftTool } from '@barocss/cad-model/chat/drafts';
import { readDxfSketch } from '@barocss/cad-model/sketch/dxfRead';
import { readFileSync } from 'node:fs';
const { text, name } = JSON.parse(process.argv[3]);
if (!text) {
  const sketch = withNode(emptyDoc(), { kind:'sketch', profile:'rectangle', min:[-10,-3], max:[-5,3] });
  console.log(JSON.stringify(withNode(sketch, { kind:'extrude', sketch:0, height:3 })));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  let parsed;
  try { parsed = readDxfSketch(text); }
  catch (error) { parsed = { error: error.message }; }
  console.log(JSON.stringify({ parsed, tool: runDraftTool(doc, 'import_drawing', { dxf: text, name }) }));
}
`,
});

const T = 2 ** 20;
function profile({ x = 0, y = 0, gap = 0.125, distant = false, reverseOrder = false } = {}) {
  const line = (a, b) => [0, 'LINE', 8, 'OUTLINE', 10, a[0] + x, 20, a[1] + y, 30, 0, 11, b[0] + x, 21, b[1] + y, 31, 0];
  const edges = [
    line([0, 0], [20, 0]), line([20, 0], [20, 10]), line([20, 10], [0, 10]), line([0, 10], [0, gap]),
  ];
  const groups = [...edges, ...(distant ? [[0, 'CIRCLE', 8, 'UNRELATED', 10, T, 20, 0, 30, 0, 40, 1]] : [])];
  const text = [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES',
    ...(reverseOrder ? groups.toReversed() : groups).flat(), 0, 'ENDSEC', 0, 'EOF', ''].join('\n');
  const parsedGroups = text.trimEnd().split('\n');
  const endpoints = new Map();
  for (let i = 0, active = false; i < parsedGroups.length; i += 2) {
    const [code, value] = parsedGroups.slice(i, i + 2);
    if (code === '0') active = value === 'LINE';
    if (active && ['10', '20', '11', '21'].includes(code)) endpoints.set(code, [...(endpoints.get(code) ?? []), Number(value)]);
  }
  const xs = endpoints.get('10'), ys = endpoints.get('20'), endXs = endpoints.get('11'), endYs = endpoints.get('21');
  const deltas = xs.map((fromX, i) => Math.min(...endXs.map((toX, j) => Math.hypot(fromX - toX, ys[i] - endYs[j]))));
  assert.deepEqual(deltas.sort((a, b) => a - b), [0, 0, 0, gap], 'encoded endpoint distances');
  return text;
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
  const open = async (file, doc) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(file);
    await f.same(doc);
  };
  const doc = await f.inspect('host-part', {}, {});
  const nativePath = join(output, 'gap-study.bcad');
  await writeFile(nativePath, JSON.stringify(doc));
  await open(nativePath, doc);
  const add = async (name, text) => {
    const path = join(output, name + '.dxf');
    await writeFile(path, text);
    await page.getByLabel('Add drawing', { exact: true }).setInputFiles(path);
  };
  const acceptedProfile = profile({ x: 24, y: 30, gap: 0 });
  const closed = await f.inspect('closed', doc, { text: acceptedProfile, name: 'closed' });
  assert.equal(closed.parsed.regions.length, 1);
  assert.deepEqual(closed.parsed.holes, []);
  assert.deepEqual([closed.parsed.regions[0].area, closed.parsed.regions[0].box], [200, [24, 30, 44, 40]]);
  await add('closed', acceptedProfile);
  await f.waitToast(/Drawing added as a draft/);
  await f.same(closed.tool.doc);
  const id = closed.tool.doc.drafts.drafts[0].id;
  const width = () => page.getByRole('spinbutton', { name: id + '.width value', exact: true });
  await width().fill('25');
  await width().press('Enter');
  await page.waitForFunction(() => window.__studioDoc.drafts.drafts[0].dims[0].value === 25);
  const edited = await f.snapshot('normal-draft-edited');
  await f.undo();
  await f.same(closed.tool.doc);
  const body = page.locator('.ol-row').filter({ has: page.locator('button.ol-eye') }).locator('button.ol').first();
  await body.click();
  const accepted = await f.snapshot('closed-draft-and-redo');
  assert.deepEqual(accepted.selection.selection.bodies, [0]);
  const controls = () => page.evaluate(() => ({
    dirty: Boolean(document.querySelector('[aria-label="Unsaved changes"]')),
    history: ['Undo', 'Redo'].map(name => {
      const button = document.querySelector('button[aria-label="' + name + '"]');
      return { disabled: button.disabled, tip: button.getAttribute('data-tip') };
    }),
  }));
  const history = await controls();
  assert.equal(history.history[1].disabled, false);
  await f.dismissToasts();

  const cases = [
    ['origin', {}], ['positive-offset', { x: T }], ['negative-offset', { x: -T }],
    ['distant-circle', { distant: true }], ['distant-circle-first', { distant: true, reverseOrder: true }],
  ];
  for (const [name, options] of cases) {
    f.phase = 'Add drawing ' + name;
    const text = profile(options);
    const inspected = await f.inspect(name, accepted.doc, { text, name });
    const miss = baseline && name !== 'origin';
    await add(name, text);
    const notice = await f.waitToast(miss ? /Drawing added as a draft/ : /Could not read this drawing.*profile is not closed/i);
    const state = await f.snapshot(name);
    if (miss) {
      assert.equal(inspected.parsed.regions[0].area, options.reverseOrder ? 198.75 : 200);
      assert.equal(inspected.tool.changed, true);
      assert.deepEqual(state.doc, inspected.tool.doc);
      assert.equal(state.doc.drafts.drafts.length, accepted.doc.drafts.drafts.length + 1);
      await f.undo();
      await f.same(accepted.doc);
    } else {
      assert.match(inspected.parsed.error, /\[DXF_OPEN\]/);
      assert.match(inspected.tool.error, /\[DXF_OPEN\]/);
      assert.equal('doc' in inspected.tool, false);
      assert.deepEqual(state.doc, accepted.doc);
      assert.deepEqual(state.bodies.bodies, accepted.bodies.bodies);
      assert.deepEqual(state.history, accepted.history);
      assert.deepEqual(state.selection.selection, accepted.selection.selection);
      assert.deepEqual(await controls(), history);
    }
    f.report.observations.push({ name, sha256: sha256(text), notice, parentIncorrectlyClosed: miss, acceptedArea: miss ? inspected.parsed.regions[0].area : null, gap: 0.125 });
    await f.dismissToasts();
  }
  if (baseline) return;

  f.phase = 'Redo the previously confirmed closed draft';
  await f.redo();
  await f.same(edited.doc);
  assert.equal(await width().inputValue(), '25');

  f.phase = 'Save the closed draft to a local project and open it in a new context';
  const project = 'D725 DXF profile';
  const savedName = 'gap-study.bcad';
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
  assert.deepEqual(JSON.parse(native), edited.doc);
  const file = join(output, 'saved-closed-draft.bcad');
  await writeFile(file, native);
  await f.newPage();
  page = f.page;
  await open(file, edited.doc);
  assert.equal(await width().inputValue(), '25');
  const reopened = await f.snapshot('closed-draft-fresh-open');
  assert.deepEqual(reopened.bodies.bodies, accepted.bodies.bodies);
  await width().fill('30');
  await width().press('Enter');
  await page.waitForFunction(() => window.__studioDoc.drafts.drafts[0].dims[0].value === 30);
  await f.snapshot('reopened-draft-edited');
  await f.undo();
  await f.same(edited.doc);
  assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ nativeSHA256: sha256(native) });
});
