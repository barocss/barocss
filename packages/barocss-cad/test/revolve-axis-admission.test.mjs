import test from 'node:test';
import assert from 'node:assert/strict';
import { revolveProfile, revolveMassProperties } from '../dist/features/revolve.js';
import { BrepError, assertValidBrep } from '../dist/brep/brep-core.js';
import { brepMassProperties } from '../dist/brep/solid-mass.js';

// Same relative criterion as the existing FRk4 revolve tests; no new tolerance.
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${actual} vs ${expected}`);
const phase = Math.PI / 128, direction = [Math.cos(phase), Math.sin(phase)];
// rho(theta)=distance+sin(theta-phase). Its minimum is theta=3*pi/2+phase.
// After the full circle splits into halves, this is k=32.5 of 64: between old sample stations.
function circleAtDistance(distance, origin = [0, 0], directionScale = 1) {
  const center = [origin[0] - distance * Math.sin(phase), origin[1] + distance * Math.cos(phase)];
  return { id: 'r', profile: [{ kind: 'arc', start: [center[0] + 1, center[1]], center, direction: 'ccw' }],
    axis: { origin, direction: direction.map(v => v * directionScale) }, angle: 360 };
}
const refused = (input, message) => {
  const before = structuredClone(input);
  assert.throws(() => revolveProfile(input), e => e instanceof BrepError && e.code === 'GEOMETRY' && e.message === message);
  assert.deepEqual(input, before);
};
function validVolume(input, expected) {
  const before = structuredClone(input), brep = revolveProfile(input);
  assert.equal(assertValidBrep(brep).valid, true);
  assert.equal(brep.bodies.length, 1); assert.ok(brep.shells.every(s => s.closed));
  // Independent expected geometry, not a volume inferred from the generated solid.
  near(revolveMassProperties(input, 1).volume, expected);
  near(brepMassProperties(brep, 1).volume, expected);
  assert.deepEqual(input, before);
}

test('revolve axis admission: an arc interior tangent between the old 65 stations is refused', () => {
  // Analytic minimum rho=0; every old sampled rho is at least 1-cos(pi/128)>0.
  assert.ok(1 - Math.cos(phase) > 0);
  for (const [origin, scale] of [[[0, 0], 1], [[3, -2], 7], [[3, -2], -7]]) {
    refused(circleAtDistance(1, origin, scale), 'B-rep: revolve: the profile touches the axis between its vertices');
  }
});

test('revolve axis admission: a narrow axis crossing between the old 65 stations is refused', () => {
  // Analytic minimum rho=-1e-6, while the nearest old samples remain positive.
  assert.ok(1 - 1e-6 - Math.cos(phase) > 0);
  for (const [origin, scale] of [[[0, 0], 1], [[3, -2], 7], [[3, -2], -7]]) {
    refused(circleAtDistance(1 - 1e-6, origin, scale), 'B-rep: revolve: the profile crosses the axis');
  }
});

test('revolve axis admission: a separated circle on the same tilted axis retains the torus volume', () => {
  // Unit disk area pi, centroid distance1.001: Pappus gives pi*2*pi*1.001.
  for (const [origin, scale] of [[[0, 0], 1], [[3, -2], 7], [[3, -2], -7]]) {
    validVolume(circleAtDistance(1.001, origin, scale), 2 * Math.PI ** 2 * 1.001);
  }
});

test('revolve axis admission: whole axial lines and their endpoint poles remain valid after an axis move', () => {
  // Rectangle h=0..2,rho=0..1 generates a cylinder: pi*r^2*h=2*pi.
  const fixtures = [
    { points: [[0, 0], [2, 0], [2, 1], [0, 1]], axis: { origin: [0, 0], direction: [1, 0] } },
    { points: [[3, -5], [3, -3], [2, -3], [2, -5]], axis: { origin: [3, -5], direction: [0, 7] } },
    { points: [[3, -5], [3, -3], [2, -3], [2, -5]], axis: { origin: [3, -5], direction: [0, -7] } },
  ];
  for (const f of fixtures) for (const angle of [90, 360]) {
    validVolume({ id: 'r', profile: f.points.map(start => ({ kind: 'line', start })), axis: f.axis, angle }, 2 * Math.PI * angle / 360);
  }
});

test('revolve axis admission: semicircle endpoint poles with an axial diameter retain a sphere', () => {
  const profile = [{ kind: 'arc', start: [-1, 0], center: [0, 0], direction: 'cw' }, { kind: 'line', start: [1, 0] }];
  // A unit upper half-disk revolved about its diameter gives V=4*pi/3.
  for (const scale of [1, -7]) validVolume({ id: 'r', profile, axis: { origin: [0, 0], direction: [scale, 0] }, angle: 360 }, 4 * Math.PI / 3);
  // Endpoint radial extremum: h=0..1 has rho=1-sqrt(1-h^2), then h=1..2 has rho=2-h.
  // Integral rho^2 dh=(5/3-pi/2)+1/3=2-pi/2, hence V=2*pi-pi^2/2.
  // The authored loop is clockwise; normalization also exercises the reversed quarter arc.
  const d = direction, s = [-d[1], d[0]], origin = [3, -2];
  const endpointProfile = [
    { kind: 'arc', start: [...origin], center: [origin[0] + s[0], origin[1] + s[1]], direction: 'ccw' },
    { kind: 'line', start: [origin[0] + d[0] + s[0], origin[1] + d[1] + s[1]] },
    { kind: 'line', start: [origin[0] + 2 * d[0], origin[1] + 2 * d[1]] },
  ];
  validVolume({ id: 'r', profile: endpointProfile, axis: { origin, direction: d.map(v => 7 * v) }, angle: 360 }, 2 * Math.PI - Math.PI ** 2 / 2);
});
