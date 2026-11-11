// D716: real desktop Trim, Extend and Split attempts on hidden sketch construction.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const [output, mode] = process.argv.slice(2);
const baseline = mode === '--baseline';
const pins = [
  'apps/cad-studio/test/sketch-cut-visibility-browser.mjs',
  'apps/cad-studio/src/sketch/useSketchActions.ts',
  'apps/cad-studio/src/app/sketchControls.ts',
  'apps/cad-studio/src/ui/ModelTools.tsx',
  'apps/cad-studio/src/viewport/sketchOverlay.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/sketch/trim.ts',
  'packages/barocss-cad-model/src/sketch/entityIds.ts',
];
const f = await createFlow({
  name: 'sketch-cut-visibility', output, envFrozen: 'D716_SOURCE_FROZEN', initialFiles: pins, requiredFrozen: pins,
  qualification: baseline ? 'Reproduce direct editing of hidden sketch construction' : 'Protect hidden construction from direct sketch editing',
  limits: ['Native XY sketch, actual toolbar and canvas clicks.'],
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
const { tool, variant } = JSON.parse(process.argv[3]);
const circle = (c, r, id) => ({kind:'circle',c,r,ids:[id],construction:true});
const line = (a,b,ids) => ({kind:'polygon',points:[a,b],bulges:[0,0],closed:false,ids,construction:true});
const construction = variant === 'arc'
  ? [{ ...line([13,5],[10,8],['e4','e5']), bulges:[Math.tan(Math.PI/8),0] }, line([0,5],[8,5],['e6','e7'])]
  : variant === 'line'
    ? [line([1,0],[3,0],['e4','e5']), circle([12,6],1,'e6')]
    : variant === 'neighbor'
      ? [circle([-2,-5.9],0.2,'e4'), { ...line([4,-3],[5,-3],['e5','e6']), lengths:{0:1} }, line([5,-3],[6,-3],['e7','e8'])]
      : tool === 'Extend'
        ? [line([1,0],[3,0],['e4','e5']), line([5,-1],[5,1],['e6','e7'])]
        : [circle([4,0],2,'e4'), circle([12,6],1,'e5')];
const sketch = withNode(emptyDoc(), { kind:'sketch', profile:'rectangle', min:[-4,-6], max:[0,-5],
  sideTags:{outer:['e0','e1','e2','e3']}, construction });
const bytes = encodeStudioFile(withNode(sketch, {kind:'extrude',sketch:0,height:1}));
const opened = await readStudioFile(bytes);
assert.ok(!('error' in opened), JSON.stringify(opened));
console.log(JSON.stringify({doc:opened.doc,bytes:Buffer.from(bytes).toString('base64')}));
`,
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
  const overlays = { Trim: 'polyline.sk-trim', Extend: 'polyline.sk-extend', Split: 'circle.sk-split' };
  const primary = [['trim', 'Trim', 6, 0], ['extend', 'Extend', 2.75, 0], ['split', 'Split', 6, 0]];
  const cases = [...primary, ...(baseline ? [] : [
    ['trim-line', 'Trim', 2, 0, 'line'], ['split-line', 'Split', 2, 0, 'line'],
    ['extend-arc', 'Extend', 10, 8, 'arc'], ['visible-neighbor', 'Split', -2, -6.1, 'neighbor'],
    ...primary.map(([label, tool, x, y]) => ['shown-' + label, tool, x, y]),
  ])];
  let saved;
  for (const [label, tool, x, y, variant] of cases) {
    f.phase = 'Open ' + label;
    const fixture = await f.inspect(label, {}, { tool, variant });
    const path = join(output, label + '.bcad');
    await writeFile(path, Buffer.from(fixture.bytes, 'base64'));
    await f.newPage();
    const page = f.page, button = name => page.getByRole('button', { name, exact: true });
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
    await chooser.setFiles(path);
    await f.same(fixture.doc);
    await page.locator('.history .hs[data-node-index="1"]').click();
    await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
    await f.sketchPanel().waitFor();
    const neighbor = variant === 'neighbor';
    if (neighbor) await button('Hide construction').click();
    await button(tool).click();
    const hidden = !label.startsWith('shown-');
    const preview = page.locator(overlays[tool]);
    const point = await page.evaluate(([x, y]) => window.__studioScreenOf([x, y, 0]), [x, y]);
    assert.ok(point?.every(Number.isFinite));
    assert.ok(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.matches('canvas.vp-canvas'), point), JSON.stringify(point));
    if (!baseline && label === 'trim') {
      await page.mouse.move(...point);
      await preview.waitFor({ state: 'attached' });
      await button('Hide construction').click();
      await preview.waitFor({ state: 'detached' });
      await button('Show construction').click();
      await preview.waitFor({ state: 'detached' });
      await f.snapshot('trim-retired-preview');
    }
    if (hidden) {
      if (!neighbor) await button('Hide construction').click();
      assert.equal(await page.locator('.sk-shape.done.construction').count(), 0);
    }
    await page.mouse.move(...point);
    const edit = baseline || !hidden || neighbor;
    if (edit) await preview.waitFor({ state: 'attached' });
    else await preview.waitFor({ state: 'detached' });
    if (neighbor) {
      const dot = await preview.evaluate(node => {
        const p = new DOMPoint(Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))).matrixTransform(node.getScreenCTM());
        return [p.x, p.y];
      });
      const visible = await page.evaluate(() => window.__studioScreenOf([-2, -6, 0]));
      assert.ok(Math.hypot(dot[0] - visible[0], dot[1] - visible[1]) < 0.5, JSON.stringify({ dot, visible }));
    }
    await f.snapshot(label + '-hover');
    await page.mouse.click(...point);
    if (!edit) await f.waitToast(new RegExp('Nothing to ' + tool.toLowerCase() + ' there'));
    if (hidden && !neighbor) {
      await button('Show construction').click();
      await f.snapshot(label + '-shown');
    }
    await page.locator('.topbar button.finish').click();
    await f.sketchPanel().waitFor({ state: 'hidden' });
    await f.ready();
    const after = await f.snapshot(label + '-applied');
    const shapes = after.doc.nodes[0].construction;
    if (!edit || neighbor) assert.deepEqual(shapes.map(shape => ({ ...shape, pending: undefined })),
      fixture.doc.nodes[0].construction.map(shape => ({ ...shape, pending: undefined })));
    else if (tool === 'Trim') assert.deepEqual(shapes.map(shape => shape.c), [[12, 6]]);
    else if (tool === 'Extend') assert.deepEqual(shapes.find(shape => shape.points?.[0]?.[0] === 1)?.points, [[1, 0], [5, 0]]);
    else {
      assert.ok(shapes.some(shape => shape.kind === 'polygon' && shape.points.length === 2 && shape.closed));
      assert.ok(!shapes.some(shape => shape.kind === 'circle' && shape.c[0] === 4));
    }
    assert.equal(after.bodies.bodies.length, 1);
    assert.ok(Math.abs(after.bodies.bodies[0].volume - 4) < 1e-8);
    f.report.observations.push({ label, tool, hidden, preview: edit, construction: shapes });
    if (neighbor) {
      const node = after.doc.nodes[0];
      assert.equal(node.outline.points.length, 5);
      assert.ok(node.outline.points.some(([x, y]) => Math.abs(x + 2) < 0.01 && y === -6));
      await f.undo();
      await f.same(fixture.doc);
      await f.redo();
      await f.same(after.doc);
      const project = 'D716 Cut visibility';
      await button('Project and versions').click();
      const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
      await panel.getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
      await panel.getByRole('button', { name: 'Project in this browser', exact: true }).click();
      await button('Save').click();
      await panel.getByRole('list', { name: 'Project documents', exact: true }).getByText(label + '.bcad', { exact: true }).waitFor();
      const bytes = Buffer.from(await page.evaluate(async ({ project, label }) => {
        const root = await navigator.storage.getDirectory();
        const dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(project);
        return [...new Uint8Array(await (await (await dir.getFileHandle(label + '.bcad')).getFile()).arrayBuffer())];
      }, { project, label }));
      assert.deepEqual(JSON.parse(bytes.toString()), after.doc);
      const savedPath = join(output, 'studio-saved.bcad');
      await writeFile(savedPath, bytes);
      saved = { path: savedPath, doc: after.doc, original: path, before: fixture.doc };
    }
  }
  if (!baseline) {
    f.phase = 'Reopen saved construction and cancel another edit';
    assert.ok(saved);
    await f.newPage();
    const page = f.page, button = name => page.getByRole('button', { name, exact: true });
    const open = async path => {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Open').click()]);
      await chooser.setFiles(path);
    };
    const edit = async () => {
      await page.locator('.history .hs[data-node-index="1"]').click();
      await f.editor().getByRole('button', { name: 'Edit sketch', exact: true }).click();
      await f.sketchPanel().waitFor();
    };
    await open(saved.path);
    await f.same(saved.doc);
    const initial = await f.snapshot('saved-reopened');
    await edit();
    assert.equal(await page.locator('.sk-shape.done.construction').count(), 3);
    await button('Split').click();
    const preview = page.locator('circle.sk-split');
    const point = await page.evaluate(() => window.__studioScreenOf([-3, -6, 0]));
    await page.mouse.move(...point);
    await preview.waitFor({ state: 'attached' });
    await button('Trim').click();
    await preview.waitFor({ state: 'detached' });
    await button('Split').click();
    await page.mouse.move(...point);
    await preview.waitFor({ state: 'attached' });
    await page.mouse.click(...point);
    await page.keyboard.press('Escape');
    await f.sketchPanel().waitFor({ state: 'hidden' });
    const cancelled = await f.snapshot('saved-cancelled');
    for (const field of ['doc', 'bodies', 'history']) assert.deepEqual(cancelled[field], initial[field], field);
    await open(saved.original);
    await f.same(saved.before);
    await edit();
    assert.equal(await preview.count(), 0);
    await f.snapshot('original-local-ids-reopened');
  }
});
