import assert from 'node:assert/strict';
import { sha256 } from './flow-helper.mjs';

const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const c = Math.sqrt(3) / 2, s = 1 / 2;
const rotation = ([x, y, z]) => [x, c * y - s * z, s * y + c * z];
const originalCenter = [12.141098054079956, 15, 7.007842511441414];
const volume = 2967.768244759665;
const width = 30, thickness = 1.5, radius = 1.5, k = 0.44, holeRadius = 2.75;
const allowance = Math.PI / 2 * (radius + k * thickness);
const length = 64 + allowance, area = width * length - 2 * Math.PI * holeRadius ** 2;
const flatTolerance = 1e-12 * length;
const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} within ${tolerance}`);
}
function pointNear(actual, expected, tolerance = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, axis) => near(value, expected[axis], tolerance));
}
function alignedFlat(flat) {
  const [outer, ...others] = flat.loops.filter(loop => loop.outer);
  assert.ok(outer && !others.length && outer.segments.length === 4 && outer.segments.every(edge => edge.kind === 'line'));
  const corners = outer.segments.map(edge => edge.a);
  const holes = flat.loops.filter(loop => !loop.outer).map(loop => {
    assert.equal(loop.segments.length, 1);
    const [arc] = loop.segments;
    assert.equal(arc.kind, 'arc');
    near(arc.radius, holeRadius, flatTolerance);
    pointNear(arc.start, arc.end, flatTolerance);
    return arc.center;
  });
  assert.equal(holes.length, 2);

  const targetHoles = [[15, 10], [15, length - 15]];
  for (const [index, origin] of corners.entries()) {
    const vectors = [corners[(index + 3) % 4], corners[(index + 1) % 4]]
      .map(point => point.map((value, axis) => value - origin[axis])).sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    const sizes = vectors.map(vector => Math.hypot(...vector));
    pointNear(sizes, [width, length], flatTolerance);
    const [across, along] = vectors.map((vector, index) => vector.map(value => value / sizes[index]));
    near(across[0] * along[0] + across[1] * along[1], 0, flatTolerance);
    const project = point => [across, along].map(unit => unit.reduce((sum, value, axis) => sum + value * (point[axis] - origin[axis]), 0));
    const aligned = holes.map(project).sort((a, b) => a[1] - b[1]);
    if (aligned.some((point, hole) => distance(point, targetHoles[hole]) > flatTolerance)) continue;
    for (const target of [[0, 0], [0, length], [width, 0], [width, length]]) {
      assert.ok(corners.map(project).some(point => distance(point, target) <= flatTolerance), target);
    }
    return { project, holes: aligned };
  }
  assert.fail('The same aligned rectangle must retain both holes');
}
function checkRotatedFlat(native) {
  const { sheet, flat, flatError } = native;
  assert.ok(sheet && flat, JSON.stringify(flatError));
  assert.equal(sheet.fixedFace, 'n0.leg0.a');
  assert.equal(sheet.thickness, thickness);
  assert.equal(sheet.bendRadius, radius);
  assert.equal(sheet.kFactor, k);
  assert.equal(sheet.bends.length, 1);
  const [bend] = sheet.bends;
  assert.equal(bend.name, 'n0.bend1');
  assert.ok([sheet.fixedFace, bend.inner, bend.outer].every(name => native.faces.filter(face => face === name).length === 1));
  pointNear(bend.axis.origin, rotation([3, 30, 3]));
  pointNear(bend.axis.direction, rotation([0, -1, 0]));
  near(bend.allowance, allowance);
  near(flat.area, area, 1e-12 * area);
  const aligned = alignedFlat(flat);
  assert.equal(flat.bends.length, 1);
  assert.equal(flat.fixedFace, sheet.fixedFace);
  const [developed] = flat.bends;
  assert.equal(developed.name, bend.name);
  assert.equal(developed.direction, 'down');
  near(developed.angle, 90, flatTolerance);
  for (const [line, station] of [[developed.centre, 27 + allowance / 2], [developed.tangents[0], 27], [developed.tangents[1], 27 + allowance]]) {
    const ends = line.map(aligned.project).sort((a, b) => a[0] - b[0]);
    pointNear(ends[0], [0, station], flatTolerance);
    pointNear(ends[1], [width, station], flatTolerance);
  }
  return { width, length, area: flat.area, holes: aligned.holes, rawBox: flat.box, bendAxis: bend.axis, direction: developed.direction };
}
async function checkFolded(f, label, doc, original) {
  const native = await f.inspect(label, doc, {});
  assert.equal(native.id, 'n7');
  assert.equal(native.valid, true);
  assert.equal(native.bodyCount, 1);
  assert.deepEqual(native.faces, original.faces);
  assert.equal(native.points.length, original.points.length);
  native.points.forEach((point, index) => pointNear(point, rotation(original.points[index])));
  const min = [0, 1, 2].map(axis => Math.min(...native.points.map(point => point[axis])));
  const max = [0, 1, 2].map(axis => Math.max(...native.points.map(point => point[axis])));
  pointNear(min, [0, -15, 0]);
  pointNear(max, [40, 30 * c, 30 * (c + s)]);
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].key, 'b7');
  for (const result of [native.mass, bodies[0]]) {
    near(result.volume, volume, 1e-9 * volume);
    pointNear(result.centroid, rotation(originalCenter));
  }
  f.report.observations.push({ label, volume: native.mass.volume, centroid: native.mass.centroid, min, max, flatError: native.flatError });
  return native;
}

export async function qualifySheetRotation(f, seed, original, { selectBody, showFlat, projectRoundTrip, baseline }) {
  f.phase = 'rotate the actual sheet 30 degrees about X at the origin';
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('r');
  const hud = f.page.getByRole('dialog', { name: 'Rotate', exact: true });
  await hud.getByLabel('Axis', { exact: true }).selectOption('x');
  await hud.getByLabel('Angle', { exact: true }).fill('30');
  for (const axis of 'XYZ') await hud.getByLabel(`Pivot ${axis}`, { exact: true }).fill('0');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  await button(hud, 'Apply').click();
  await hud.waitFor({ state: 'hidden' });
  await f.changed(seed);
  const rotated = await f.doc();
  assert.deepEqual(rotated.nodes.at(-1), { kind: 'rotate', parent: { node: 6, side: 'solid' }, axis: 'x', angle: 30, pivot: [0, 0, 0], id: 'n7' });
  assert.deepEqual(rotated.nodes.slice(0, -1), seed.nodes);
  const result = await checkFolded(f, 'rotated-native', rotated, original);
  await selectBody();
  if (baseline) {
    assert.equal(result.sheet, null);
    assert.equal(result.flatError.code, 'CAPABILITY');
    assert.equal(await button(f.page, 'Show the flat pattern').count(), 0);
    await f.snapshot('02-rotated-without-flat');
    return;
  }
  f.phase = 'verify the rotated flat and restore it through history';
  f.report.observations.push({ label: 'aligned-flat', ...checkRotatedFlat(result) });
  await showFlat('02-rotated-flat');
  await f.undo();
  await f.same(seed);
  await selectBody();
  await showFlat('03-undo-flat');
  await f.redo();
  await f.same(rotated);
  await selectBody();
  await showFlat('04-redo-flat');

  f.phase = 'save and freshly reopen the rotated sheet';
  const bytes = await projectRoundTrip(rotated);
  const reopened = await checkFolded(f, 'reopened-rotated-native', rotated, original);
  f.report.observations.push({ label: 'reopened-aligned-flat', ...checkRotatedFlat(reopened), bytes: bytes.length, sha256: sha256(bytes) });
  await selectBody();
  await showFlat('05-reopened-rotated-flat');
}
