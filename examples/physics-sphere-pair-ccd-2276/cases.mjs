// Frozen represented inputs. Radius operands remain separate for exact Fraction audits.
const v = (x, y = 0, z = 0) => [x, y, z];
const original = { id: 'original-head-on', radii: [.05, .05], starts: [v(-.5), v(.5)], velocities: [v(100), v(-100)], dt: 1 / 30, expectedClass: 'HIT' };
const tiny = { radii: [.0001, .0001], starts: [v(5, .00020000001), v(-5)], velocities: [v(-600), v(600)], dt: 1 / 60, expectedClass: 'MISS' };
const ordinary = { radii: [.25, .25], starts: [v(.5), v(-.5)], velocities: [v(-15), v(15)], dt: 1 / 60, expectedClass: 'HIT' };
const definitions = [
 original,
 { ...tiny, id: 'false-graze-witness' },
 { ...tiny, id: 'exact-graze', starts: [v(5, .0002), v(-5)], expectedClass: 'HIT' },
 { ...tiny, id: 'just-inside', starts: [v(5, .00019999999), v(-5)], expectedClass: 'HIT' },
 { ...ordinary, id: 'zero-relative', starts: [v(1), v(0)], velocities: [v(15), v(15)], expectedClass: 'MISS' },
 { ...ordinary, id: 'initial-touch', starts: [v(.5), v(0)], velocities: [v(0), v(0)], expectedClass: 'OWNED' },
 { ...ordinary, id: 'initial-overlap', starts: [v(.25), v(0)], velocities: [v(0), v(0)], expectedClass: 'OWNED' },
 { ...ordinary, id: 'separating', velocities: [v(15), v(-15)], expectedClass: 'MISS' },
 { ...ordinary, id: 'endpoint-entry' },
 { ...ordinary, id: 'beyond-endpoint', velocities: [v(-7.5), v(7.5)], expectedClass: 'MISS' },
 { ...ordinary, id: 'endpoint-graze', starts: [v(.5, .5), v(-.5)], velocities: [v(-30), v(30)] },
 { ...original, id: 'head-on-input-order', reverse: true },
 { ...original, id: 'head-on-marker-order', marker: 1 },
 { ...original, id: 'head-on-both-orders', reverse: true, marker: 1 },
 { ...tiny, id: 'graze-input-order', starts: [v(5, .0002), v(-5)], expectedClass: 'HIT', reverse: true },
 { ...tiny, id: 'graze-marker-order', starts: [v(5, .0002), v(-5)], expectedClass: 'HIT', marker: 1 },
 { ...tiny, id: 'false-graze-marker-order', marker: 1 },
 { ...original, id: 'translated-hit', translation: [1.25, 0, -.5] },
 { ...tiny, id: 'translated-miss', translation: [1.25, 0, -.5] },
 { ...original, id: 'scale-hit', scale: 2 },
 { ...ordinary, id: 'scale-miss', starts: [v(.5, .50000001), v(-.5)], velocities: [v(-30), v(30)], expectedClass: 'MISS', scale: 2 },
 { ...original, id: 'unequal-radius-hit', radii: [.0001, .0002] },
];
export const cases = Object.freeze(definitions.map(c => {
 const scale = c.scale ?? 1, translation = c.translation ?? [0, 0, 0];
 return Object.freeze({ ...c, marker: c.marker ?? 0, reverse: c.reverse ?? false,
  radii: Object.freeze(c.radii.map(x => x * scale)),
  starts: Object.freeze(c.starts.map(p => Object.freeze(p.map((x, i) => x * scale + translation[i])))),
  velocities: Object.freeze(c.velocities.map(p => Object.freeze(p.map(x => x * scale)))) });
}));
export const gates = Object.freeze({ toi: 1e-12, distance: 1e-12, normal: 1e-12, normalNormSquared: 1e-12, finiteMotion: 1e-10 });
// Finite22 + repeat1 + recorder2 + known2 + unknown2 Worlds; helper22 calls.
// Finite22 + repeat1 + recorder4(includes replay1) + known4 + unknown2 steps.
export const budget = Object.freeze({ worlds: 29, acceptedSteps: 33, directHelperCalls: 22, maxWorlds: 40, maxAcceptedSteps: 128, maxEvidenceBytes: 16 * 1024 * 1024 });
