// Frozen binary64 inputs. No threshold epsilon and no iterative solver oracle.
const base = { kind: 'floor', axis: 1, speed: 2, mass: 2, fixedE: .25, movingE: .8, dt: 1 / 120, reverse: false, lexicalSwap: false };
const definitions = [
 ['minimum-material', {}],
 ['below-threshold', { speed: .49999999999999994 }],
 ['at-threshold', { speed: .5 }],
 ['above-threshold', { speed: .5000000000000001 }],
 ['zero-moving', { movingE: 0 }],
 ['zero-fixed', { fixedE: 0 }],
 ['unit', { fixedE: 1, movingE: 1 }],
 ['unequal-reverse-material', { fixedE: .8, movingE: .25 }],
 ['model-order', { reverse: true }],
 ['lexical-order', { lexicalSwap: true }],
 ['both-orders', { reverse: true, lexicalSwap: true }],
 ['separating', { speed: -2 }],
 ['resting', { speed: 0 }],
 ['axis-x', { axis: 0 }],
 ['axis-z', { axis: 2 }],
 ['dt-60', { dt: 1 / 60 }],
 ['dt-240', { dt: 1 / 240 }],
 ['equal-mass', { kind: 'pair' }],
 ['equal-mass-orders', { kind: 'pair', reverse: true, lexicalSwap: true }],
 ['equal-mass-unit-x', { kind: 'pair', axis: 0, fixedE: 1, movingE: 1 }],
];
export const cases = Object.freeze(definitions.map(([id, values]) => Object.freeze({ ...base, ...values, id })));
export const gates = Object.freeze({ velocity: 1e-10, omega: 1e-10, impulse: 1e-10, momentum: 1e-10, angularMomentum: 1e-10, gap: 1e-10, energy: 1e-10, tangent: 1e-12 });
// Per graph: 20 finite, repeat1, support1, record2, known2, unknown2 Worlds.
// Steps: 20 + 1 + 256 + 4(record includes one replay) + 4 known + 2 unknown.
export const budget = Object.freeze({ worlds: 28, acceptedSteps: 287, maxWorlds: 48, maxAcceptedSteps: 1024, maxEvidenceBytes: 16 * 1024 * 1024 });
export const support = Object.freeze({ ...base, id: 'gravity-support', fixedE: 0, movingE: 0, speed: 0, steps: 256, gravity: [0, -9.81, 0] });
