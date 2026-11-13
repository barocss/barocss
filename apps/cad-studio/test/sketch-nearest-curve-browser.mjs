import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const pins = [
  'apps/cad-studio/test/sketch-nearest-curve-browser.mjs',
  'apps/cad-studio/src/ui/SketchMarks.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts',
  'packages/barocss-cad-model/src/sketch/select.ts',
];
const f = await createFlow({
  name: 'sketch-nearest-curve', output: process.argv[2], envFrozen: 'D1052_SOURCE_FROZEN',
  qualification: 'Hover and click choose the nearest curve across a 4 CSS pixel Sketch gap.',
  limits: ['One axis-aligned outline with an inner circle in desktop Studio.'],
  initialFiles: pins, requiredFrozen: pins,
  inspectorSource: `
import assert from 'node:assert/strict';
import { emptyDoc, withNode } from '@barocss/cad-model/engine/doc';
import { profileOf } from '@barocss/cad-model/sketch/loops';
const result = profileOf([{ kind: 'polygon', closed: true, points: [[0,0],[80,0],[80,35],[0,35]],
  circles: [{ c: [27,6.75], r: 6 }] }]);
assert.ok('node' in result);
console.log(JSON.stringify(withNode(emptyDoc(), result.node)));
`,
});
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const select = state => f.page.locator(`.vp-overlay .${state}[data-sketch-entity]`);
const project = world => f.page.evaluate(world => window.__studioScreenOf(world), world);
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const entities = state => select(state).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-sketch-entity')));

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, viewport: { width: 1024, height: 800 }, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  const doc = await f.inspect('close-curve-source', {});
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'close-curve.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await f.same(doc);
  await button('Sketch · polygon', f.page.getByRole('group', { name: 'History', exact: true })).click();
  await button('Edit sketch', f.editor()).click();
  await f.sketchPanel().waitFor();
  await settle();

  const edgeWorld = [27, 0, 0], rimWorld = [27, 0.75, 0];
  const initialEdge = await project(edgeWorld), initialRim = await project(rimWorld);
  await f.page.mouse.move(...initialEdge);
  const delta = Math.log(Math.abs(initialEdge[1] - initialRim[1]) / 4) / 0.0015;
  await f.page.mouse.wheel(0, delta);
  await settle();
  const edge = await project(edgeWorld), rim = await project(rimWorld);
  const gap = edge[1] - rim[1];
  assert.ok(Math.abs(gap - 4) < 0.2, { edge, rim, gap });
  const samples = [
    ['line', edge, 'edge:0'],
    ['nearer-line', [edge[0], edge[1] - gap * 0.25], 'edge:0'],
    ['nearer-circle', [rim[0], rim[1] + gap * 0.25], 'circle'],
    ['rim', rim, 'circle'],
    ['vertex', await project([0, 0, 0]), 'point:0'],
  ];
  const results = [];
  for (const [label, pixel, expected] of samples) {
    f.phase = label;
    await f.page.mouse.click(edge[0] + 8, edge[1] + 50);
    await settle();
    assert.deepEqual(await entities('on'), []);
    assert.ok(await f.page.evaluate(pixel => !!document.elementFromPoint(...pixel)?.closest('canvas.vp-canvas'), pixel), pixel);
    await f.page.mouse.move(...pixel);
    await settle();
    const hover = await entities('hover');
    await f.page.mouse.click(...pixel);
    await settle();
    const clicked = await entities('on');
    f.report.observations.push({ label, pixel, gap, hover, clicked });
    results.push([label, expected, hover, clicked]);
    await f.snapshot(label);
  }
  await f.same(doc);
  assert.deepEqual(f.report.downloads, []);
  for (const [label, expected, hover, clicked] of results) {
    f.phase = label;
    assert.equal(hover.length, 1);
    assert.equal(clicked.length, 1);
    assert.equal(expected === 'circle' ? hover[0].split(':')[0] : hover[0], expected);
    assert.equal(expected === 'circle' ? clicked[0].split(':')[0] : clicked[0], expected);
  }
});
