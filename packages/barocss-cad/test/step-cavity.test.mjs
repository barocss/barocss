import assert from 'node:assert/strict';
import test from 'node:test';
import { BrepError, brepMassProperties, checkBrep, evaluateCadPart, exportStep, faceGeometry, importStep, tessellateBrep } from '../dist/index.js';
import { stepCavityFixture } from './step-cavity-fixture.mjs';
import { inspectPlanarCavity } from './step-cavity-oracle.mjs';

const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, JSON.stringify({ actual, expected, tolerance }));
const reject = (text, message) => assert.throws(() => importStep(text), error => error instanceof BrepError && error.code === 'INPUT' && message.test(error.message));

// Signed solid angle of the actual outward material triangles at each test point.
function winding(mesh, point) {
  const p = mesh.positions, indices = mesh.indices;
  let angle = 0;
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const ray = vertex => point.map((value, axis) => p[3 * vertex + axis] - value);
  for (let i = 0; i < indices.length; i += 3) {
    const a = ray(indices[i]), b = ray(indices[i + 1]), c = ray(indices[i + 2]);
    const A = Math.hypot(...a), B = Math.hypot(...b), C = Math.hypot(...c);
    const triple = a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    angle += 2 * Math.atan2(triple, A * B * C + dot(a, b) * C + dot(b, c) * A + dot(c, a) * B);
  }
  return angle / (4 * Math.PI);
}

test('independent planar cavity STEP reads its actual shell directions, first moments and material', () => {
  const cases = [
    { voids: [], volume: 1000, moment: [5000, 5000, 5000], empty: [] },
    { voids: [[[4,4,4],[6,6,6]]], volume: 992, moment: [4960, 4960, 4960], empty: [[5,5,5]] },
    { voids: [[[2,2,2],[4,4,4]]], volume: 992, moment: [4976, 4976, 4976], empty: [[3,3,3]] },
    { voids: [[[2,2,2],[4,4,4]], [[6,5,2],[9,7,3]]], volume: 986, moment: [4931, 4940, 4961], empty: [[3,3,3],[7.5,6,2.5]] },
  ];
  for (const fixture of cases) {
    const { text } = stepCavityFixture(fixture.voids);
    const [oracle] = inspectPlanarCavity(text);
    near(oracle.volume, fixture.volume);
    const brep = importStep(text), mass = brepMassProperties(brep, 1);
    assert.equal(checkBrep(brep, { strict: true }).valid, true);
    assert.equal(brep.bodies[0].shells.length, fixture.voids.length + 1);
    assert.equal(brep.faces.length, 6 * (fixture.voids.length + 1));
    near(mass.volume, fixture.volume);
    mass.centroid.forEach((coord, axis) => near(coord * mass.volume, fixture.moment[axis]));
    for (let i = 0; i < fixture.voids.length; i++) {
      const floor = brep.faces.find(face => face.name === 'void-' + (i + 1) + '-bottom');
      assert.deepEqual(faceGeometry(floor).n.map(value => value || 0), [0,0,1]);
    }
    const mesh = tessellateBrep(brep);
    near(winding(mesh, [1,1,1]), 1);
    for (const point of [[11,5,5], ...fixture.empty]) near(winding(mesh, point), 0);

    const written = exportStep(brep, { timestamp: '2026-11-12T00:00:00Z' });
    const [output] = inspectPlanarCavity(written);
    near(output.outer.volume, 1000);
    assert.equal(output.voids.length, fixture.voids.length);
    output.voids.forEach((item, i) => {
      const v = fixture.voids[i][1].reduce((product, max, axis) => product * (max - fixture.voids[i][0][axis]), 1);
      assert.equal(item.forward, false);
      near(item.base.volume, v);
      near(item.effective.volume, -v);
    });
    near(output.volume, fixture.volume);
    output.centroid.forEach((coord, axis) => near(coord * output.volume, fixture.moment[axis]));
  }
});

test('STEP cavity admission refuses malformed wrappers, duplicates and old inward base shells', () => {
  const { text, inner: [inner], wrappers: [wrapper], outer, solid } = stepCavityFixture();
  const wrapperLine = wrapper + "=ORIENTED_CLOSED_SHELL('',*," + inner + ',.F.);';
  assert.ok(text.includes(wrapperLine));
  const withWrapper = replacement => text.replace(wrapperLine, wrapper + '=' + replacement + ';');
  for (const value of ['.T.', '.U.', '$', "'F'"]) {
    reject(withWrapper("ORIENTED_CLOSED_SHELL('',*," + inner + ',' + value + ')'), /ORIENTED_CLOSED_SHELL.*orientation/);
  }
  reject(withWrapper("ORIENTED_CLOSED_SHELL('','*'," + inner + ',.F.)'), /derived face set/);
  reject(withWrapper("ORIENTED_CLOSED_SHELL('',*," + wrapper + ',.F.)'), /nested wrappers/);
  reject(withWrapper("ORIENTED_CLOSED_SHELL('',*,#999999,.F.)"), /#999999 is missing/);
  reject(withWrapper("ORIENTED_CLOSED_SHELL('',*," + outer + ',.F.)'), /more than once/);
  reject(withWrapper("ORIENTED_CLOSED_SHELL('',*,#,.F.)"), /bad instance reference/);
  const declaration = solid + "=BREP_WITH_VOIDS('box-with-cavity'," + outer + ',(' + wrapper + '));';
  assert.ok(text.includes(declaration));
  const withVoidSet = members => text.replace(declaration, solid + "=BREP_WITH_VOIDS('box-with-cavity'," + outer + ',(' + members + '));');
  reject(withVoidSet(''), /at least one void shell/);
  reject(withVoidSet(inner), /requires ORIENTED_CLOSED_SHELL/);
  reject(withVoidSet(wrapper + ',' + wrapper), /more than once/);

  const lines = text.split('\n'), refs = line => [...line.matchAll(/#\d+/g)].map(m => m[0]);
  const index = id => lines.findIndex(line => line.startsWith(id + '='));
  const reverseSense = line => line.replace(/,\.T\.\);$/, ',.F.);');
  const shellFaces = refs(lines[index(inner)]).slice(1);
  for (const face of shellFaces) {
    const i = index(face), bound = index(refs(lines[i])[1]);
    lines[i] = reverseSense(lines[i]);
    lines[bound] = reverseSense(lines[bound]);
  }
  const legacy = lines.join('\n');
  const [incorrect] = inspectPlanarCavity(legacy);
  near(incorrect.voids[0].base.volume, -8);
  near(incorrect.voids[0].effective.volume, 8);
  reject(legacy, /BREP_WITH_VOIDS void shell.*orientation is inconsistent/);

  const flippedFace = shellFaces[0];
  const faceOnly = text.split('\n').map(line => line.startsWith(flippedFace + '=') ? reverseSense(line) : line).join('\n');
  assert.throws(() => inspectPlanarCavity(faceOnly), /face\/loop orientation disagrees/);
  reject(faceOnly, /orientation|sense/);
  const [ignored] = inspectPlanarCavity(withWrapper("ORIENTED_CLOSED_SHELL('',*," + inner + ',.T.)'));
  near(ignored.voids[0].effective.volume, 8);
  near(ignored.volume, 1008);
});

test('curved native cavity keeps its material volume after outward STEP shell serialization', () => {
  const { outputs: [body] } = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 's', kind: 'sketch', profile: 'circle', center: [0,0], radius: 5 },
    { id: 'e', kind: 'extrude', sketch: 's', height: 10 },
    { id: 'cavity', kind: 'shell', target: 'e', thickness: 1 },
  ] });
  assert.equal(body.brep.bodies[0].shells.length, 2);
  const step = exportStep(body, { timestamp: '2026-11-12T00:00:00Z' });
  const reopened = importStep(step);
  assert.equal(checkBrep(reopened, { strict: true }).valid, true);
  near(brepMassProperties(reopened, 1).volume, 122 * Math.PI, 1e-5);
  const mesh = tessellateBrep(reopened);
  near(winding(mesh, [0,0,5]), 0);
  near(winding(mesh, [0,0,0.5]), 1);
});

test('STEP rejects spatially invalid planar voids even with correct individual shell orientation', () => {
  const cases = [
    { voids: [[[2,2,2],[8,8,8]], [[4,4,4],[6,6,6]]], sum: 776, material: 784, reason: /void shells.*nested/ },
    { voids: [[[1,4,4],[9,6,6]], [[4,1,3],[6,9,7]]], sum: 904, material: 912, reason: /void shells.*touch or intersect/ },
    { voids: [[[2,2,2],[4,4,4]], [[4,2,2],[6,4,4]]], sum: 984, material: 984, reason: /void shells.*touch or intersect/ },
    { voids: [[[2,2,2],[4,4,4]], [[4,4,4],[6,6,6]]], sum: 984, material: 984, reason: /void shells.*touch or intersect/ },
    { voids: [[[11,4,4],[13,6,6]]], sum: 992, material: 1000, reason: /void shell.*not strictly inside outer shell/ },
    { voids: [[[8,4,4],[12,6,6]]], sum: 984, material: 992, reason: /void shell.*not strictly inside outer shell/ },
    { voids: [[[0,4,4],[2,6,6]]], sum: 992, material: 992, reason: /void shell.*not strictly inside outer shell/ },
  ];
  for (const fixture of cases) for (const voids of [fixture.voids, fixture.voids.toReversed()]) {
    const { text } = stepCavityFixture(voids);
    const [oracle] = inspectPlanarCavity(text);
    near(oracle.volume, fixture.sum);
    assert.ok(fixture.sum <= fixture.material);
    assert.ok(oracle.voids.every(item => item.base.volume > 0 && item.effective.volume < 0));
    reject(text, fixture.reason);
  }
});

test('STEP spatial checks preserve face holes and do not treat nested boxes as nested boundaries', () => {
  const tube = [[2,2,2],[8,8,8], [[4,4],[6,6]]], center = [[4.5,4.5,4.5],[5.5,5.5,5.5]];
  for (const voids of [[tube, center], [center, tube]]) {
    const { text } = stepCavityFixture(voids);
    const [oracle] = inspectPlanarCavity(text);
    near(oracle.volume, 807);
    const brep = importStep(text);
    assert.equal(checkBrep(brep, { strict: true }).valid, true);
    const mass = brepMassProperties(brep, 1);
    near(mass.volume, 807);
    mass.centroid.forEach(value => near(value, 5));
    const mesh = tessellateBrep(brep);
    for (const point of [[1,1,1], [5,5,3]]) near(winding(mesh, point), 1);
    for (const point of [[3,5,5], [5,5,5]]) near(winding(mesh, point), 0);
    const [exported] = inspectPlanarCavity(exportStep(brep));
    near(exported.volume, 807);
  }
  for (const [z0, z1] of [[1, 9], [2, 8]]) {
    const throughOpening = [[4.5,4.5,z0],[5.5,5.5,z1]];
    const { text } = stepCavityFixture([tube, throughOpening]);
    const [oracle] = inspectPlanarCavity(text);
    near(oracle.volume, 808 - (z1 - z0));
    const brep = importStep(text);
    near(brepMassProperties(brep, 1).volume, 808 - (z1 - z0));
    near(winding(tessellateBrep(brep), [4.2,5,3]), 1);
  }

  const through = [[4,4],[6,6]];
  const valid = stepCavityFixture([[[1,1,4],[2,2,5]]], through).text;
  near(brepMassProperties(importStep(valid), 1).volume, 959);
  const outside = stepCavityFixture([[[4.5,4.5,4],[5.5,5.5,5]]], through).text;
  reject(outside, /void shell.*not strictly inside outer shell/);

  const separated = stepCavityFixture([[[2,2,2],[4,4,4]], [[4 + 2 ** -48,2,2],[6,4,4]]]).text;
  near(brepMassProperties(importStep(separated), 1).volume, 984);
});
