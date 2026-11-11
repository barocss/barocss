// D748: actual Finish with a closed profile and unfinished ordinary sketch geometry.
import assert from 'node:assert/strict';
import { createFlow, sha256 } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/sketch-open-chain-finish-browser.mjs',
  'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/app/sketchControls.ts',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/sketch/trim.ts',
  'packages/barocss-cad-model/src/sketch/loops.ts',
];
const f = await createFlow({
  name: 'sketch-open-chain-finish', output, envFrozen: 'D748_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce silent loss of open line, arc and partial Trim' : 'Refuse Finish while authored open geometry remains',
  limits: ['Desktop XY sketch, normal Finish and an ordinary 8 mm Extrude.'],
  inspectorSource: `
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
const sketch = withNode(emptyDoc(), { kind:'sketch', profile:'rectangle', min:[0,0], max:[20,10], sideTags:{outer:['e1','e2','e3','e4']} });
console.log(JSON.stringify({ doc: withNode(sketch, { kind:'extrude', sketch:0, height:8 }) }));
`,
  snapshotExtra: () => ({
    geometry: [...document.querySelectorAll('.vp-overlay .sk-shape')].map(el => [el.tagName, el.getAttribute('class'), el.getAttribute('points')]),
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
  }),
});

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

  const button = name => f.page.getByRole('button', { name, exact: true });
  const open = () => f.page.locator('.vp-overlay polyline.sk-shape.open');
  const points = async (...input) => {
    for (const point of input) await f.worldClick(point);
  };
  const start = async () => {
    await f.newPage();
    await button('New part').click();
    await f.page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
    await f.ready();
    await f.page.locator('.mode').getByRole('button', { name: 'Sketch', exact: true }).click();
    await f.sketchPanel().waitFor();
    await f.frame([[0, 0], [50, 30]]);
  };
  const rect = async () => {
    await f.tool('Rectangle', 'r');
    await points([0, 0], [20, 10]);
  };
  const line = async () => {
    await f.tool('Line', 'l');
    await points([30, 0], [40, 0]);
    await open().waitFor({ state: 'attached' });
  };
  const finishInput = async trigger => {
    if (trigger === 'enter') {
      await f.page.evaluate(() => document.activeElement?.blur());
      await f.page.keyboard.press('Enter');
    } else await f.page.locator('.topbar button.finish').click();
  };
  const refusal = async (label, trigger, where) => {
    f.phase = label;
    const before = await f.snapshot(label + '-before');
    const raw = await open().evaluateAll(nodes => nodes.map(node => node.getAttribute('points')));
    assert.ok(raw.length >= 1);
    await finishInput(trigger);
    if (baseline) {
      await f.sketchPanel().waitFor({ state: 'hidden' });
      await f.changed(before.doc);
      return f.snapshot(label + '-silent-success');
    }
    const alert = f.sketchPanel().getByRole('alert');
    await alert.waitFor();
    assert.match(await alert.textContent(), where);
    assert.equal(await f.page.locator('.toast').count(), 0);
    await f.sketchPanel().waitFor();
    assert.deepEqual(await open().evaluateAll(nodes => nodes.map(node => node.getAttribute('points'))), raw);
    await f.same(before.doc);
    const after = await f.snapshot(label + '-refused');
    for (const field of ['doc', 'history', 'selection', 'dirty', 'geometry']) assert.deepEqual(after[field], before[field], field);
    assert.deepEqual(after.bodies.bodies, before.bodies.bodies);
    return after;
  };

  f.phase = 'Current open line beside a completed rectangle';
  await start();
  await rect();
  await line();
  const lineOutcome = await refusal('active-line-enter', 'enter', /\(30, 0\).*\(40, 0\)/);
  if (baseline) {
    assert.equal(lineOutcome.doc.nodes.length, 1);
    assert.equal(lineOutcome.doc.nodes[0].profile, 'rectangle');
    assert.equal(lineOutcome.doc.nodes[0].construction, undefined);
    assert.equal(lineOutcome.doc.nodes[0].regions, undefined);
  } else {
    await points([35, 10], [30, 0]);
    await f.sketchPanel().getByRole('alert').waitFor({ state: 'hidden' });
    const closed = await f.finishSketch('closed-line-retry');
    assert.equal(closed.doc.nodes[0].profile, 'rectangle');
    assert.deepEqual(closed.doc.nodes[0].regions[0].map(segment => segment.start), [[30, 0], [40, 0], [35, 10]]);
  }

  f.phase = 'Finished centre arc moved to an inactive draft shape';
  await start();
  await rect();
  await f.tool('Centre arc', 'q');
  await points([35, 18], [40, 18]);
  for (const angle of [Math.PI / 6, Math.PI / 3, Math.PI / 2]) {
    const pixel = await f.screenOf([35 + 5 * Math.cos(angle), 18 + 5 * Math.sin(angle)]);
    await f.page.mouse.move(...pixel);
  }
  await points([35, 23]);
  await f.tool('Rectangle', 'r');
  await f.page.locator('.vp-overlay polyline.sk-shape.done.open').waitFor({ state: 'attached' });
  const arcOutcome = await refusal('parked-arc-button', 'button', /\(40, 18\).*\(35, 23\)/);
  if (baseline) assert.equal(arcOutcome.doc.nodes[0].profile, 'rectangle');
  else {
    await f.page.keyboard.press('Escape');
    await f.sketchPanel().waitFor({ state: 'hidden' });
    await f.same(arcOutcome.doc);
  }

  f.phase = 'First keyhole Trim leaves one closed circle and one open chain';
  await start();
  await rect();
  await f.tool('Circle', 'c');
  await points([20, 5], [24, 5]);
  await f.tool('Trim', 't');
  await points([20, 5]);
  await f.page.locator('.vp-overlay polyline.sk-shape.done.open').waitFor({ state: 'attached' });
  const trimOutcome = await refusal('partial-keyhole-button', 'button', /\(20, 9\).*\(20, 1\)/);
  if (baseline) {
    assert.equal(trimOutcome.doc.nodes[0].profile, 'circle');
    assert.deepEqual(trimOutcome.doc.nodes[0].center, [20, 5]);
    assert.equal(trimOutcome.doc.nodes[0].radius, 4);
    return;
  }
  await points([16, 5]);
  await f.sketchPanel().getByRole('alert').waitFor({ state: 'hidden' });
  await open().first().waitFor({ state: 'detached' });
  const keyhole = await f.finishSketch('complete-keyhole');
  assert.equal(keyhole.doc.nodes[0].profile, 'loop');
  assert.equal(keyhole.doc.nodes[0].segments.filter(segment => segment.kind === 'arc').length, 1);
  assert.equal(keyhole.doc.nodes[0].regions, undefined);
  await f.openExtrudeHud();
  const solid = await f.applyExtrude({ distance: 8, previous: keyhole.doc, label: 'complete-keyhole' });
  assert.equal(solid.bodies.bodies.length, 1);
  assert.ok(Math.abs(solid.bodies.bodies[0].volume - 8 * (200 + 8 * Math.PI)) < 1e-7);

  f.phase = 'In-place Finish keeps the accepted Extrude and permits explicit Trim';
  await f.newPage();
  const { doc: source } = await f.inspect('source-extrude', {}, {});
  const file = 'open-chain-source.bcad';
  const bytes = Buffer.from(JSON.stringify(source));
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: file, mimeType: 'application/json', buffer: bytes });
  await f.same(source);
  f.report.observations.push({ sourceSHA256: sha256(bytes) });
  const edit = async () => {
    await f.openFeatureEditor(1);
    await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
    await f.sketchPanel().waitFor();
    await f.frame([[0, 0], [50, 30]]);
  };
  await edit();
  await line();
  await refusal('existing-sketch-button', 'button', /\(30, 0\).*\(40, 0\)/);
  await f.tool('Trim', 't');
  await points([35, 0]);
  await open().first().waitFor({ state: 'detached' });

  await button('Construction').click();
  await line();
  await button('Construction').click();
  await f.tool('Bézier', 'b');
  await points([30, 20], [35, 25], [40, 20]);
  const retained = await f.finishSketch('construction-and-bezier-retained');
  const sketch = retained.doc.nodes[0];
  assert.deepEqual(sketch.sideTags, source.nodes[0].sideTags);
  assert.equal(sketch.id, source.nodes[0].id);
  assert.deepEqual(retained.doc.nodes[1], source.nodes[1]);
  assert.deepEqual(retained.doc.outputs, source.outputs);
  assert.deepEqual(sketch.construction.map(shape => [shape.kind, !!shape.construction]), [['polygon', true], ['bezier', false]]);
  assert.deepEqual(sketch.construction[0].points, [[30, 0], [40, 0]]);
  assert.deepEqual(sketch.construction[1].poles, [[30, 20], [35, 25], [40, 20]]);
  assert.ok(Math.abs(retained.bodies.bodies[0].volume - 1600) < 1e-8);
  await f.undo();
  await f.same(source);
  await f.redo();
  await f.same(retained.doc);

  const project = 'D748 sketch finish';
  const panel = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const attach = async () => {
    if (!(await panel().isVisible())) await button('Project and versions').click();
    await panel().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
    await panel().getByRole('button', { name: 'Project in this browser', exact: true }).click();
    await panel().getByLabel('Project', { exact: true }).waitFor();
  };
  await attach();
  await button('Save').click();
  await panel().getByRole('list', { name: 'Project documents', exact: true }).getByText(file, { exact: true }).waitFor();
  const saved = await f.page.evaluate(async ([project, file]) => {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
    return (await (await dir.getFileHandle(file)).getFile()).text();
  }, [project, file]);
  assert.deepEqual(JSON.parse(saved), retained.doc);
  f.report.files.push({ name: file, sha256: sha256(saved) });
  await panel().getByRole('button', { name: 'Close project', exact: true }).click();
  await panel().getByLabel('Project', { exact: true }).waitFor({ state: 'hidden' });
  await f.page.reload();
  await f.ready();
  await attach();
  await panel().getByRole('button', { name: 'Open ' + file, exact: true }).click();
  await f.same(retained.doc);
  await edit();
  const reopened = await f.snapshot('fresh-open-construction-and-bezier');
  assert.equal(reopened.geometry.filter(([, name]) => name.includes('construction') && name.includes('open')).length, 1);
  await f.page.keyboard.press('Escape');
  await f.sketchPanel().waitFor({ state: 'hidden' });
  await f.same(retained.doc);
  assert.deepEqual(f.report.downloads, []);
});
