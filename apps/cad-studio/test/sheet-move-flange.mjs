import assert from 'node:assert/strict';
import { sha256 } from './flow-helper.mjs';
import { clickModelCommand } from './model-rail-helper.mjs';

const edge = 'n0.end|n0.leg1.a';
const center = [47, 12, 11];
const radius = 1.5, k = 0.44, width = 30, bore = 2.75;
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} within ${tolerance}`);
}
function pointNear(actual, expected, tolerance) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => near(value, expected[index], tolerance));
}
async function checkFlanged(f, label, doc, thickness) {
  const native = await f.inspect(label, doc, {});
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].key, 'b8');
  assert.equal(native.id, 'n8');
  assert.equal(native.valid, true);
  assert.equal(native.bodyCount, 1);
  assert.ok(native.flat, JSON.stringify(native.flatError));
  const s = radius + thickness;
  const volume = width * (thickness * (90 - 4 * s) + Math.PI / 2 * (s ** 2 - radius ** 2)) -
    2 * Math.PI * bore ** 2 * thickness;
  const centroid = thickness === 1.5 ? [24.829364946235103, 12, 14.472116772185263] : [24.825299761813632, 12, 14.734323805784078];
  for (const mass of [native.mass, bodies[0]]) {
    near(mass.volume, volume, volume * 1e-9);
    pointNear(mass.centroid, centroid, 1e-9);
  }
  const min = [0, 1, 2].map(axis => Math.min(...native.points.map(point => point[axis])));
  const max = [0, 1, 2].map(axis => Math.max(...native.points.map(point => point[axis])));
  pointNear(min, [7, -3, -9 + thickness]);
  pointNear(max, [47, 27, 41]);

  const allowance = Math.PI / 2 * (radius + k * thickness);
  const deduction = 2 * s - allowance, length = 90 - 2 * deduction;
  const area = width * length - 2 * Math.PI * bore ** 2;
  const flatTolerance = 1e-12 * length;
  assert.equal(native.sheet.fixedFace, 'n0.leg0.a');
  assert.equal(native.sheet.thickness, thickness);
  assert.equal(native.sheet.kFactor, k);
  assert.deepEqual(native.sheet.bends.map(bend => bend.name), ['n0.bend1', 'n8.bend']);
  const axis = native.sheet.bends[1].axis;
  near(axis.origin[0], 47 - s);
  near(axis.origin[2], 11 - radius);
  assert.ok(Math.abs(axis.origin[1] + 3) <= 1e-9 || Math.abs(axis.origin[1] - 27) <= 1e-9);
  pointNear(axis.direction.map(Math.abs), [0, 1, 0]);
  const flat = native.flat;
  pointNear(flat.box.min, [0, 0], flatTolerance);
  pointNear(flat.box.max, [width, length], flatTolerance);
  near(flat.area, area, 1e-12 * area);
  assert.equal(flat.loops.filter(loop => loop.outer).length, 1);
  const holes = flat.loops.filter(loop => !loop.outer).map(loop => {
    assert.equal(loop.segments.length, 1);
    const [arc] = loop.segments;
    assert.equal(arc.kind, 'arc');
    near(arc.radius, bore, flatTolerance);
    pointNear(arc.start, arc.end, flatTolerance);
    return arc.center;
  }).sort((a, b) => a[1] - b[1]);
  assert.equal(holes.length, 2);
  pointNear(holes[0], [15, 10], flatTolerance);
  pointNear(holes[1], [15, 55 - deduction], flatTolerance);
  assert.deepEqual(flat.bends.map(bend => [bend.name, bend.direction]), [['n0.bend1', 'down'], ['n8.bend', 'up']]);
  const expectedStations = [30 - s + allowance / 2, 70 - 3 * s + 3 * allowance / 2];
  flat.bends.forEach((bend, index) => {
    near(bend.angle, 90, flatTolerance);
    near(bend.allowance, allowance, flatTolerance);
    for (const point of bend.centre) near(point[1], expectedStations[index], flatTolerance);
  });
  f.report.observations.push({ label, thickness, volume: native.mass.volume, centroid: native.mass.centroid,
    min, max, axis, length: flat.box.max[1], area: flat.area, holes, bends: flat.bends.map(bend => [bend.name, bend.direction]) });
}
export async function qualifyMovedFlange(f, moved, reopened, { selectBody, showFlat, projectRoundTrip }) {
  f.phase = 'pick the unique moved sheet edge in the real viewport';
  assert.equal(reopened.edges.filter(name => name === edge).length, 1, JSON.stringify(reopened.edges));
  await button(f.page, 'View cube directions').click();
  await f.page.getByRole('menuitem', { name: 'Bottom right', exact: true }).click();
  await f.page.getByTitle('Frame all (F)', { exact: true }).click();
  const filter = button(f.page, 'Selection filter');
  for (let attempt = 0; attempt < 4 && !(await filter.innerText()).includes('Edges'); attempt++) await filter.click();
  assert.match(await filter.innerText(), /Edges/);
  await f.page.waitForTimeout(450);
  const pixel = await f.page.evaluate(world => window.__studioScreenOf(world), center);
  assert.ok(pixel?.length === 2 && pixel.every(Number.isFinite), pixel);
  assert.ok(await f.page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('canvas.vp-canvas'), pixel), pixel);
  await f.page.mouse.click(...pixel);
  await f.page.waitForFunction(() => window.__studioSelection.selection.edges.length === 1, null, { timeout: 8000 });
  await f.snapshot('06-picked-edge');

  f.phase = 'apply a 20 mm full-width flange on the moved source';
  await clickModelCommand(f.page, 'Modify', 'Flange');
  const hud = f.page.getByRole('dialog', { name: 'Flange', exact: true });
  await hud.waitFor();
  await f.snapshot('07-flange-preview');
  await hud.getByText(edge, { exact: true }).waitFor({ timeout: 8000 });
  assert.equal(await hud.getByLabel('Length', { exact: true }).inputValue(), '20');
  assert.equal(await hud.getByLabel('Angle', { exact: true }).inputValue(), '90');
  assert.equal(await hud.getByLabel('Position', { exact: true }).inputValue(), 'material-inside');
  assert.equal(await hud.getByLabel('Length to', { exact: true }).inputValue(), 'outer');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  await button(hud, 'Apply').click();
  await hud.waitFor({ state: 'hidden' });
  await f.changed(moved);
  const flanged = await f.doc(), added = flanged.nodes.at(-1);
  assert.deepEqual([added.kind, added.id, added.parent, added.edges, added.length],
    ['sheet-flange', 'n8', { node: 7, side: 'solid' }, [edge], 20]);
  assert.deepEqual(flanged.nodes.slice(0, -1), moved.nodes);
  await checkFlanged(f, 'flanged-native', flanged, 1.5);
  await selectBody();
  await showFlat('08-two-bends');

  f.phase = 'undo and redo the flange then reopen it from the project';
  await f.undo();
  await f.same(moved);
  await f.redo();
  await f.same(flanged);
  const bytes = await projectRoundTrip(flanged);
  f.report.observations.push({ label: 'flange-project-readback', bytes: bytes.length, sha256: sha256(bytes) });
  await checkFlanged(f, 'reopened-flange-native', flanged, 1.5);

  f.phase = 'edit the original sheet thickness on the reopened flange';
  await f.openFeatureEditor(0, 'original sheet thickness');
  const thickness = f.editor().getByLabel('Thickness', { exact: true });
  assert.equal(await thickness.inputValue(), '1.5');
  await thickness.fill('2');
  await f.applyEditor(flanged, 'sheet-thickness-2');
  const edited = await f.doc();
  assert.equal(edited.nodes[0].thickness, 2);
  assert.deepEqual(edited.nodes.slice(1), flanged.nodes.slice(1));
  await checkFlanged(f, 'reopened-flange-thickness2', edited, 2);
  await selectBody();
  await showFlat('09-two-bends-thickness2');
}
