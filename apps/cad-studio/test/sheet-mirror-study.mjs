import assert from 'node:assert/strict';
import { sha256 } from './flow-helper.mjs';

const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const width = 30, thickness = 1.5, radius = 1.5, holeRadius = 2.75, k = 0.44;
const holeVolume = Math.PI * holeRadius ** 2 * thickness;
const volume = 2967.768244759665;
const centroid = [12.141098054079956, 15 - 3 * holeVolume / volume, 7.007842511441414];
const allowance = Math.PI / 2 * (radius + k * thickness);
const length = 64 + allowance;
const area = width * length - 2 * Math.PI * holeRadius ** 2;
const flatTolerance = 1e-12 * length;
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function pointNear(actual, expected, tolerance = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((coordinate, index) => near(coordinate, expected[index], tolerance));
}
function checkFolded(native, expectedVolume, expectedCenter, min, max) {
  assert.equal(native.valid, true);
  near(native.mass.volume, expectedVolume, expectedVolume * 1e-9);
  pointNear(native.mass.centroid, expectedCenter);
  pointNear([0, 1, 2].map(axis => Math.min(...native.points.map(point => point[axis]))), min);
  pointNear([0, 1, 2].map(axis => Math.max(...native.points.map(point => point[axis]))), max);
}
function checkFlat(flat, mirrored) {
  near(flat.area, area, 1e-12 * area);
  pointNear(flat.box.min, [0, 0], flatTolerance);
  pointNear(flat.box.max, [width, length], flatTolerance);
  assert.equal(flat.fixedFace, 'n0.leg0.a');
  assert.equal(flat.loops.length, 3);
  assert.equal(flat.loops.filter(loop => loop.outer && loop.area > 0).length, 1);
  const holes = flat.loops.filter(loop => !loop.outer).map(loop => {
    assert.ok(loop.area < 0);
    assert.equal(loop.segments.length, 1);
    const [arc] = loop.segments;
    assert.equal(arc.kind, 'arc');
    near(arc.radius, holeRadius, flatTolerance);
    pointNear(arc.start, arc.end, flatTolerance);
    return arc.center;
  }).sort((a, b) => a[1] - b[1]);
  assert.equal(holes.length, 2);
  const expectedHoles = mirrored ? [[18, 15], [15, length - 10]] : [[15, 10], [18, length - 15]];
  holes.forEach((point, index) => pointNear(point, expectedHoles[index], flatTolerance));
  assert.deepEqual(flat.bends.map(bend => [bend.name, bend.direction]), [['n0.bend1', 'down']]);
  near(flat.bends[0].allowance, allowance, flatTolerance);
  near(flat.bends[0].angle, 90, flatTolerance);
  const bendCenter = 27 + allowance / 2;
  for (const point of flat.bends[0].centre) near(point[1], mirrored ? length - bendCenter : bendCenter, flatTolerance);
  return { area: flat.area, box: flat.box, holes, bend: flat.bends[0] };
}

export async function qualifyMirrorBoundary(f, seed, { name, selectBody, showFlat, projectRoundTrip }) {
  const source = { ...seed, nodes: seed.nodes.map(node => node.id === 'n1' ? { ...node, center: [25, 18] } : node) };
  const mirror = { kind: 'mirror', parent: { node: 6, side: 'solid' }, plane: 'yz', id: 'n7' };
  const expected = { ...source, nodes: [...source.nodes, mirror], outputs: { b7: { node: 7, side: 'solid' } }, nextId: 8 };

  f.phase = 'read the asymmetric native sheet and single reflected control';
  const nativeSource = await f.inspect('asymmetric-sheet-native', source, { mirror: true });
  assert.equal(nativeSource.bodyCount, 1);
  assert.equal(nativeSource.fixedFace.kind, 'plane');
  pointNear(nativeSource.fixedFace.n, [-1, 0, 0]);
  checkFolded(nativeSource, volume, centroid, [0, 0, 0], [40, 30, 30]);
  const originalFlat = checkFlat(nativeSource.flat, false);
  const reflected = await f.inspect('single-reflection-native', expected, { mirror: true, reflectOnly: true });
  assert.equal(reflected.feature.keep, false);
  assert.equal(reflected.bodyCount, 1);
  assert.equal(reflected.fixedFace.kind, 'plane');
  pointNear(reflected.fixedFace.n, [1, 0, 0]);
  assert.deepEqual(reflected.faces, nativeSource.faces);
  checkFolded(reflected, volume, [-centroid[0], centroid[1], centroid[2]], [-40, 0, 0], [0, 30, 30]);
  assert.equal(reflected.sheet, null);
  assert.equal(reflected.flatError.code, 'CAPABILITY');
  const reflectedFlat = checkFlat(reflected.manualFlat, true);
  f.report.observations.push({ label: 'native-mirror-contrast', originalFlat, reflectedFlat,
    reflectedVolume: reflected.mass.volume, reflectedCentroid: reflected.mass.centroid, reflectedNormal: reflected.fixedFace.n,
    reflectedReport: reflected.sheet, reflectedNativeFlatError: reflected.flatError });

  f.phase = 'use the existing Studio Mirror at the origin';
  await f.newPage();
  const [chooser] = await Promise.all([f.page.waitForEvent('filechooser'), button(f.page, 'Open').click()]);
  await chooser.setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await f.same(source);
  await selectBody();
  await showFlat('01-asymmetric-source-flat');
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.page.keyboard.press('m');
  const hud = f.page.getByRole('dialog', { name: 'Mirror', exact: true });
  await hud.getByLabel('Plane', { exact: true }).selectOption('yz');
  await hud.getByLabel('Plane at', { exact: true }).fill('0');
  await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent.trim() === 'preview');
  await f.snapshot('02-legacy-mirror-preview');
  await button(hud, 'Apply').click();
  await hud.waitFor({ state: 'hidden' });
  await f.changed(source);
  await f.same(expected);
  const combined = await f.inspect('studio-combined-mirror-native', expected, { mirror: true });
  assert.equal(combined.feature.keep, true);
  checkFolded(combined, volume * 2, [0, centroid[1], centroid[2]], [-40, 0, 0], [40, 30, 30]);
  const { fresh, massReady, bodies } = await f.bodies();
  assert.ok(fresh && massReady);
  assert.deepEqual(bodies.map(body => body.key), ['b7']);
  near(bodies[0].volume, volume * 2, volume * 2e-9);
  assert.equal(combined.sheet, null);
  assert.equal(combined.flatError.code, 'CAPABILITY');
  await selectBody();
  assert.equal(await button(f.page, 'Show the flat pattern').count(), 0);
  await f.snapshot('03-legacy-combined-without-flat');

  f.phase = 'verify exact first history and project Open of the legacy Mirror';
  await f.undo();
  await f.same(source);
  await selectBody();
  await showFlat('04-undo-restores-source-flat');
  await f.redo();
  await f.same(expected);
  const saved = await projectRoundTrip(expected);
  await selectBody();
  assert.equal(await button(f.page, 'Show the flat pattern').count(), 0);
  await f.snapshot('05-reopened-legacy-mirror');
  f.report.observations.push({ label: 'studio-legacy-mirror', keep: combined.feature.keep, bodyCount: combined.bodyCount,
    volume: combined.mass.volume, centroid: combined.mass.centroid, flatError: combined.flatError, bytes: saved.length, sha256: sha256(saved) });
}
