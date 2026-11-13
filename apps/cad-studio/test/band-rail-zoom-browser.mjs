import assert from 'node:assert/strict';
import { createFlow } from './flow-helper.mjs';

const mode = process.argv[3];
const baseline = mode === '--baseline';
const checkDisplay = ['--display', '--display-equal', '--display-webgl2'].includes(mode);
const equal = ['--equal', '--equal-baseline', '--display-equal'].includes(mode);
const pins = ['apps/cad-studio/test/band-rail-zoom-browser.mjs', 'apps/cad-studio/src/viewport/Viewport.tsx',
  'apps/cad-studio/src/viewport/viewportPointerInput.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts',
  'packages/barocss-cad-model/src/engine/mesh.ts',
  ...(checkDisplay ? ['packages/barocss-cad-model/src/engine/bandRailDisplay.ts', 'packages/barocss-cad-model/src/app/lookKey.ts',
    'packages/barocss-cad-model/src/engine/meshWire.ts', 'apps/cad-studio/src/App.tsx'] : [])];
const f = await createFlow({
  name: 'band-rail-zoom', output: process.argv[2], envFrozen: checkDisplay ? 'D1147_SOURCE_FROZEN' : 'D1146_SOURCE_FROZEN',
  initialFiles: pins, requiredFrozen: pins,
  qualification: 'Read the committed Band sheet, with both source cylinders hidden, and locate its native rails.',
  limits: ['One closed two-patch coaxial Band, native height 30 mm and upright rails.'],
  inspectorSource: `
import { readFileSync } from 'node:fs';
import { partBreps, evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { nativeCircleOf } from '@barocss/cad-model/engine/nativeCircle';
const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { brep } = partBreps(doc).find(item => item.key === 'b4');
const result = evaluateDoc(doc, 1);
const body = result.bodies.find(item => item.key === 'b4');
console.log(JSON.stringify({
  native: brep.edges.flatMap(edge => {
    const owners = brep.coedges.filter(use => use.edge === edge.id);
    const circle = nativeCircleOf(edge.curve);
    return owners.length === 1 && circle ? [{ name: edge.name, radius: circle.radius, center: circle.centre }] : [];
  }), displayEdges: body.mesh.edges.map(edge => edge.names), area: body.area,
}));
`,
});
const solid = node => ({ node, side: 'solid' });
const source = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 5,
  nodes: [{ id: 'n0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: equal ? 10 : 20 },
    { id: 'n1', kind: 'extrude', sketch: 0, height: 10 },
    { id: 'n2', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 },
    { id: 'n3', kind: 'extrude', sketch: 2, height: 10, from: 40 },
    { id: 'n4', kind: 'band-surface', version: 1,
      a: { parent: solid(1), edges: ['n1.side0#2|n1.top', 'n1.side0#1|n1.top'] },
      b: { parent: solid(3), edges: ['n3.bottom|n3.side0#2', 'n3.bottom|n3.side0#1'] } }],
  outputs: { b1: solid(1), b3: solid(3), b4: solid(4) },
};
const button = (name, scope = f.page) => scope.getByRole('button', { name, exact: true });
const settle = () => f.page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
const project = point => f.page.evaluate(p => window.__studioScreenOf(p), point);

await f.run(async () => {
  await f.newPage();
  if (mode === '--display-webgl2') {
    await f.page.goto(f.server.resolvedUrls.local[0] + '?renderer=webgl2');
    await f.page.locator('.viewport[data-renderer="webgl2"]').waitFor();
    await f.ready();
  }
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button('Open').click()]);
  await chooser.setFiles({ name: 'D1146-band.bcad', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  f.phase = 'verify exact Band native rail names and keep only the Band visible';
  const geometry = await f.inspect('native-rails', source);
  const radius = equal ? 10 : 20, expectedArea = Math.PI * (radius + 10) * Math.hypot(radius - 10, 30);
  assert.ok(Math.abs(geometry.area - expectedArea) < 1e-7);
  assert.equal(geometry.native.length, 4);
  assert.deepEqual(geometry.native.map(rail => rail.name).sort(), ['n4.a|n4.band0', 'n4.a|n4.band1', 'n4.b|n4.band0', 'n4.b|n4.band1']);
  for (const rail of geometry.native) {
    const a = rail.name.includes('.a|');
    assert.ok(Math.abs(rail.radius - (a ? radius : 10)) < 1e-9);
    assert.ok(Math.hypot(rail.center[0], rail.center[1], rail.center[2] - (a ? 10 : 40)) < 1e-9);
  }
  const rows = f.page.locator('.outliner .ol-row');
  assert.equal(await rows.count(), 3);
  await button('Hide body', rows.nth(0)).click();
  await button('Hide body', rows.nth(1)).click();
  const accepted = await f.doc();
  const { sigs, ...band } = accepted.nodes[4];
  assert.deepEqual(accepted.nodes.slice(0, 4), source.nodes.slice(0, 4));
  assert.deepEqual(band, source.nodes[4]);
  if (sigs) assert.deepEqual(Object.keys(sigs).sort(), [...band.a.edges, ...band.b.edges].sort());
  await button('Top').click();
  if (await button('Ortho').getAttribute('aria-pressed') !== 'true') await button('Ortho').click();
  const filter = button('Selection filter');
  for (let i = 0; i < 4 && !(await filter.innerText()).includes('Edges'); i++) await filter.click();
  assert.match(await filter.innerText(), /Edges/);
  await settle();
  if (checkDisplay) {
    assert.equal(await button('Hide body', rows.nth(2)).isVisible(), true);
    await f.page.mouse.move(...await project([0, 0, 40]));
    await f.page.mouse.wheel(0, 740);
    await settle();
  }
  const angle = 0.36, axis = [Math.cos(angle), Math.sin(angle)];
  const world = (r, z) => [...axis.map(component => component * r), z];
  const samples = [['lower', world(radius, 10)], ['upper', world(10, 40)]];
  f.phase = 'click the exact rail positions in committed Band-only display';
  const observations = [];
  for (const [label, at] of samples) {
    const point = await project(at);
    await f.page.mouse.move(point[0] - 10, point[1]);
    await f.page.mouse.move(...point);
    const edge = await f.page.evaluate(p => window.__studioEdgeAt(p), at);
    await f.page.mouse.click(...point);
    await settle();
    const selection = await f.page.evaluate(() => window.__studioSelection.selection);
    const selectedRail = await f.page.evaluate(() => window.__studioSelectedBandRail?.() ?? null);
    observations.push({ label, edge: edge && { body: edge.body, index: edge.edge, rail: edge.rail, segmentCount: edge.segments.length }, selection, selectedRail });
    await f.snapshot(label + '-band-rail');
  }
  f.report.observations.push({ label: 'native-band', geometry }, ...observations);
  await f.same(accepted);
  assert.deepEqual(geometry.displayEdges, []);
  if (checkDisplay) {
    assert.ok(observations.every(shot => shot.edge?.body === 2 && shot.selectedRail === shot.edge.rail && shot.selection.edges.length === 0));
    if (!equal) {
      assert.match(observations[0].selectedRail, /^n4\.a\|/);
      assert.match(observations[1].selectedRail, /^n4\.b\|/);
    }
    const last = observations.at(-1);
    await f.page.mouse.move(...await project(samples.at(-1)[1]));
    await f.page.mouse.wheel(0, equal ? -925 : -650);
    await settle();
    const zoomed = await f.page.evaluate(p => window.__studioEdgeAt(p), samples.at(-1)[1]);
    assert.equal(zoomed.rail, last.selectedRail);
    assert.ok(zoomed.segments.length > last.edge.segmentCount);
    assert.equal(await f.page.evaluate(() => window.__studioSelectedBandRail()), last.selectedRail);
    const error = await f.page.evaluate(({ segments, z }) => {
      let max = 0;
      for (const [x0, y0, z0, x1, y1, z1] of segments) {
        const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
        const factor = 10 / Math.hypot(x, y);
        const projected = window.__studioScreenOf([x, y, (z0 + z1) / 2]);
        const analytic = window.__studioScreenOf([x * factor, y * factor, z]);
        max = Math.max(max, Math.hypot(projected[0] - analytic[0], projected[1] - analytic[1]));
      }
      return max;
    }, { segments: zoomed.segments, z: zoomed.rail.includes('.a|') ? 10 : 40 });
    assert.ok(error <= 0.25, String(error));
    f.report.observations.push({ label: 'zoomed-rail', name: zoomed.rail, segments: zoomed.segments.length, maxChordErrorCSS: error });
    await f.snapshot('zoomed-selected-rail');
    await f.page.keyboard.press('Escape');
    assert.equal(await f.page.evaluate(() => window.__studioSelectedBandRail()), null);
    await f.page.mouse.click(...await project(samples.at(-1)[1]));
    assert.equal(await f.page.evaluate(() => window.__studioSelectedBandRail()), zoomed.rail);
    await button('Hide body', rows.nth(2)).click();
    await settle();
    assert.equal(await f.page.evaluate(() => window.__studioSelectedBandRail()), null);
    assert.deepEqual((await f.doc()).nodes, accepted.nodes);
    assert.deepEqual(f.report.downloads, []);
    return;
  }
  assert.ok(observations.every(shot => shot.edge === null && !shot.selection.edges.length));
  if (baseline || mode === '--equal-baseline') {
    assert.fail('The committed Band has four native circular rails but no viewport edge owner');
  }
  assert.deepEqual(f.report.downloads, []);
});
