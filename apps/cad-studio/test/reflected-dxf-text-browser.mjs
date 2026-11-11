// D721: exercise the real Drafts DXF consumer for reflected and ordinary planar TEXT.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/reflected-dxf-text-browser.mjs',
  'apps/cad-studio/src/state/useSpecificationActions.ts',
  'apps/cad-studio/src/ui/DraftsPanel.tsx',
  'apps/cad-studio/src/viewport/Viewport.tsx',
  'packages/barocss-cad-model/src/sketch/dxfRead.ts',
  'packages/barocss-cad-model/src/sketch/dxfUnderlay.ts',
  'packages/barocss-cad-model/src/chat/drafts.ts',
];
const f = await createFlow({
  name: 'reflected-dxf-text', output, envFrozen: 'D721_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce a reflected DXF glyph accepted as a normal text record' : 'Refuse reflected planar DXF TEXT without changing the part',
  limits: ['Self-authored planar DXF TEXT with asymmetrical glyphs and a closed ring profile. Desktop Studio Drafts import.'],
  inspectorSource: `
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { runDraftTool } from '@barocss/cad-model/chat/drafts';
import { readDxfSketch } from '@barocss/cad-model/sketch/dxfRead';
import { readUnderlay } from '@barocss/cad-model/sketch/dxfUnderlay';
import { readFileSync } from 'node:fs';
const { text, name, to = 1 } = JSON.parse(process.argv[3]);
if (!text) {
  const sketch = withNode(emptyDoc(), { kind:'sketch',profile:'rectangle',min:[-10,-3],max:[10,3] });
  console.log(JSON.stringify(withNode(sketch, { kind:'extrude',sketch:0,height:3 })));
} else {
  const doc = JSON.parse(readFileSync(process.argv[2],'utf8'));
  function attempt(read) {
    try { return read(); }
    catch(error) { return {error:error.message}; }
  }
  console.log(JSON.stringify({
    underlay:attempt(() => readUnderlay(text,to)),
    sketch:attempt(() => readDxfSketch(text)),
    tool:runDraftTool(doc,'import_drawing',{ dxf:text, name }),
  }));
}
`,
});

function dxfText({ extrusion = 1, angle = 30, unit = 4 }) {
  return [
    0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, unit, 0, 'ENDSEC',
    0, 'SECTION', 2, 'ENTITIES',
    0, 'CIRCLE', 8, 'OUTER', 10, 0, 20, 0, 30, 0, 40, 5,
    0, 'CIRCLE', 8, 'HOLE', 10, 0, 20, 0, 30, 0, 40, 1,
    0, 'TEXT', 8, 'NOTE', 10, 4, 20, 6, 30, 0, 40, 2, 1, 'F2',
    50, angle, 210, 0, 220, 0, 230, extrusion,
    0, 'ENDSEC', 0, 'EOF', '',
  ].join('\n');
}

function assertDrawingDoc(actual, expected) {
  const compared = structuredClone(expected);
  for (const [i, underlay] of compared.underlays.entries()) for (const [j, text] of underlay.texts.entries()) {
    const observed = actual.underlays[i].texts[j];
    for (const field of ['angle', 'height']) {
      assert.ok(Math.abs(observed[field] - text[field]) < 1e-10, field);
      text[field] = observed[field];
    }
  }
  assert.deepEqual(actual, compared);
}

function assertTextGroups(text, expectedAngle, expectedExtrusion) {
  const lines = text.trimEnd().split('\n');
  const pairs = Array.from({ length: lines.length / 2 }, (_, i) => [Number(lines[i * 2]), lines[i * 2 + 1]]);
  const textIndex = pairs.findIndex(([code, value]) => code === 0 && value === 'TEXT');
  assert.ok(textIndex >= 0);
  const end = pairs.findIndex(([code], i) => i > textIndex && code === 0);
  const groups = new Map(pairs.slice(textIndex + 1, end));
  assert.deepEqual([groups.get(1), Number(groups.get(50)), Number(groups.get(230))], ['F2', expectedAngle, expectedExtrusion]);
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
  const doc = await f.inspect('source', {}, {});
  const nativePath = join(output, 'native.bcad');
  await writeFile(nativePath, JSON.stringify(doc));
  const open = async (file, expected) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(file);
    await f.same(expected);
  };
  await open(nativePath, doc);
  await button('Top').click();
  const initial = await f.snapshot('native-open');
  assert.equal(initial.bodies.bodies.length, 1);
  assert.ok(Math.abs(initial.bodies.bodies[0].volume - 360) < 1e-8);

  const add = async (name, text) => {
    const path = join(output, name + '.dxf');
    await writeFile(path, text);
    await page.getByLabel('Add drawing', { exact: true }).setInputFiles(path);
  };
  const name = 'reflected-30';
  const reflected = dxfText({ extrusion: -1 });
  assertTextGroups(reflected, 30, -1);
  f.phase = 'Read reflected TEXT through source and actual Drafts UI';
  const inspected = await f.inspect(name, doc, { text: reflected, name });
  if (baseline) {
    assert.deepEqual(inspected.underlay.counts, { TEXT: 1 });
    assert.equal(inspected.sketch.regions.length, 1);
    assert.equal(inspected.sketch.holes.length, 1);
    assert.equal(inspected.tool.changed, true);
    await add(name, reflected);
    await f.changed(doc);
    await f.waitToast(/Shown as an underlay: 1 TEXT/);
    await page.locator('.vp-overlay .underlay').waitFor({ state: 'attached' });
    const after = await f.snapshot('parent-accepted-reflection');
    const text = after.doc.underlays[0].texts[0];
    assert.deepEqual(text.at, [-4, 6]);
    assert.equal(text.text, 'F2');
    assert.equal(text.height, 2);
    assert.ok(Math.abs(text.angle - 150) < 1e-10);
    assert.deepEqual(Object.keys(text).sort(), ['angle', 'at', 'height', 'text']);
    f.report.observations.push({ originalExtrusion: -1, originalAngle: 30, renderedAs: text,
      sourceCounts: inspected.underlay.counts, nativeVolume: after.bodies.bodies[0].volume });
    return;
  }

  const refusal = /\[DXF_UNSUPPORTED\].*reflected planar TEXT/;
  const verifyRefusal = (record) => {
    assert.match(record.underlay.error, refusal);
    assert.match(record.sketch.error, refusal);
    assert.match(record.tool.error, refusal);
    assert.equal('doc' in record.tool, false);
  };
  verifyRefusal(inspected);
  const historyTips = () => Promise.all(['Undo', 'Redo'].map(name => button(name).getAttribute('data-tip')));
  const overlay = () => page.locator('.vp-overlay .underlay');
  const drawnText = id => page.waitForFunction(key => window.__studioOverlayTexts?.()[key]?.includes('F2'), 'underlay:text:' + id);
  const beforeTips = await historyTips();
  for (const angle of [0, 30, 90]) {
    f.phase = `Refuse reflected TEXT at ${angle} degrees`;
    const reflected = dxfText({ extrusion: -1, angle });
    const name = 'reflected-' + angle;
    assertTextGroups(reflected, angle, -1);
    if (angle !== 30) verifyRefusal(await f.inspect(name, doc, { text: reflected, name }));
    await add(name, reflected);
    await f.waitToast(/Could not read this drawing.*reflected planar TEXT/i);
    const after = await f.snapshot(name + '-refused');
    assert.deepEqual(after.doc, initial.doc);
    assert.deepEqual(after.bodies.bodies, initial.bodies.bodies);
    assert.deepEqual(after.history, initial.history);
    assert.deepEqual(await historyTips(), beforeTips);
    assert.equal(await overlay().count(), 0);
    assert.equal(await page.locator('[aria-label="Unsaved changes"]').count(), 0);
    await f.dismissToasts();
  }

  f.phase = 'Import the supported +Z text and the original profile';
  const nameNormal = 'ordinary-30';
  const normal = dxfText({});
  assertTextGroups(normal, 30, 1);
  const ordinary = await f.inspect(nameNormal, doc, { text: normal, name: nameNormal });
  const withoutText = normal.slice(0, normal.indexOf('0\nTEXT\n')) + '0\nENDSEC\n0\nEOF\n';
  const profile = await f.inspect('profile-only', doc, { text: withoutText, name: 'profile-only' });
  assert.deepEqual(ordinary.sketch.regions, profile.sketch.regions);
  assert.deepEqual(ordinary.sketch.holes, profile.sketch.holes);
  assert.equal(ordinary.sketch.unit.name, 'millimetres');
  assert.deepEqual(ordinary.sketch.regions.map(r => r.circle), [{ center: [0, 0], radius: 5 }]);
  assert.deepEqual(ordinary.sketch.holes.map(r => r.circle), [{ center: [0, 0], radius: 1 }]);
  const note = ordinary.underlay.texts[0];
  assert.deepEqual(note.at, [4, 6]);
  assert.equal(note.text, 'F2');
  assert.ok(Math.abs(note.height - 2) < 1e-10 && Math.abs(note.angle - 30) < 1e-10);
  assert.deepEqual(ordinary.underlay.counts, { TEXT: 1 });
  assert.deepEqual(ordinary.tool.content.dims.map(d => d.value), [10, 10, 2]);
  await add(nameNormal, normal);
  await f.changed(doc);
  assertDrawingDoc(await f.doc(), ordinary.tool.doc);
  await f.waitToast(/Shown as an underlay: 1 TEXT/);
  await overlay().waitFor({ state: 'attached' });
  const accepted = await f.snapshot('ordinary-imported');
  assert.deepEqual(accepted.bodies.bodies, initial.bodies.bodies);
  assert.equal(accepted.doc.underlays[0].name, nameNormal);
  assert.equal(accepted.doc.nodes[2].holes.length, 1);
  await drawnText(accepted.doc.underlays[0].id);
  await f.dismissToasts();

  await f.undo();
  await f.same(initial.doc);
  const redoTips = await historyTips();
  await add(name, reflected);
  await f.waitToast(/Could not read this drawing.*reflected planar TEXT/i);
  assert.deepEqual(await f.doc(), initial.doc);
  assert.deepEqual(await historyTips(), redoTips);
  await f.redo();
  await f.same(accepted.doc);
  await f.dismissToasts();
  const id = accepted.doc.underlays[0].id;
  await button('Hide underlay ' + id).click();
  await overlay().waitFor({ state: 'detached' });
  assert.equal((await f.doc()).underlays[0].hidden, true);
  await page.waitForFunction(key => !window.__studioOverlayTexts?.()[key], 'underlay:text:' + id);
  await button('Show underlay ' + id).click();
  await overlay().waitFor({ state: 'attached' });
  assert.equal((await f.doc()).underlays[0].hidden, false);
  await drawnText(id);

  f.phase = 'Read a second supported drawing with declared inches';
  const inchName = 'ordinary-inches';
  const inches = dxfText({ angle: 90, unit: 1 });
  const inchSource = await f.doc();
  const inch = await f.inspect(inchName, inchSource, { text: inches, name: inchName, to: 25.4 });
  assert.equal(inch.sketch.unit.name, 'inches');
  assert.ok(Math.hypot(inch.underlay.texts[0].at[0] - 101.6, inch.underlay.texts[0].at[1] - 152.4) < 1e-10);
  assert.ok(Math.abs(inch.underlay.texts[0].height - 50.8) < 1e-10);
  assert.deepEqual(inch.tool.content.dims.map(d => d.value), [254, 254, 50.8]);
  await add(inchName, inches);
  await f.changed(inchSource);
  assertDrawingDoc(await f.doc(), inch.tool.doc);
  assert.equal(await overlay().count(), 2);
  const inchState = await f.snapshot('ordinary-inches-imported');
  assert.deepEqual(inchState.bodies.bodies, initial.bodies.bodies);

  f.phase = 'Keep legacy native text records and ordinary project Save compatible';
  const project = 'D721 DXF text';
  await button('Project and versions').click();
  const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
  await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
  await button('Save').click();
  await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText('native.bcad', { exact: true }).waitFor();
  const bytes = Buffer.from(await page.evaluate(async projectName => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    return [...new Uint8Array(await (await (await dir.getFileHandle('native.bcad')).getFile()).arrayBuffer())];
  }, project));
  assert.deepEqual(JSON.parse(bytes.toString()), inchState.doc);
  const saved = join(output, 'studio-saved.bcad');
  await writeFile(saved, bytes);
  f.report.observations.push({ nativeSha256: createHash('sha256').update(bytes).digest('hex'), controls: [note, inch.underlay.texts[0]] });
  await f.newPage();
  page = f.page;
  await open(saved, inchState.doc);
  assert.equal(await overlay().count(), 2);
  await f.snapshot('fresh-native-reopen');

  const legacy = structuredClone(accepted.doc);
  legacy.underlays[0].texts = [{ at: [-4, 6], text: 'F2', height: 2, angle: 150 }];
  const legacyFile = join(output, 'legacy.bcad');
  await writeFile(legacyFile, JSON.stringify(legacy));
  await open(legacyFile, legacy);
  await overlay().waitFor({ state: 'attached' });
  await drawnText(legacy.underlays[0].id);
  assert.deepEqual((await f.snapshot('legacy-native-text')).doc, legacy);
});
