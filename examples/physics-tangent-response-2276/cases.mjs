// Frozen finite principal-frame centered controls. No tilted/off-center claims.
const base = { half: [1, .5, .5], vx: 1, vz: 1, speed: 1, muS: 1, muD: .5, dt: 1 / 128, cycles: 0, reverse: false, lexicalSwap: false, branch: 'stick' };
const definitions = [
 ['anisotropic-base', {}], ['reverse-both', { vx: -1, vz: -1 }],
 ['reverse-x', { vx: -1 }], ['reverse-z', { vz: -1 }],
 ['x-only', { vz: 0 }], ['z-only', { vx: 0 }],
 ['cyclic-once', { cycles: 1 }], ['cyclic-twice', { cycles: 2 }],
 ['isotropic-cube', { half: [.5, .5, .5] }],
 ['dt-60', { dt: 1 / 60 }], ['dt-120', { dt: 1 / 120 }], ['dt-240', { dt: 1 / 240 }],
 ['zero-friction', { muS: 0, muD: 0, branch: 'zero' }],
 ['high-friction', { muS: 4, muD: 2 }],
 ['clear-dynamic-ray', { muS: .1, muD: .05, branch: 'slide' }],
 ['model-order', { reverse: true }], ['lexical-order', { lexicalSwap: true }],
 ['both-orders', { reverse: true, lexicalSwap: true }],
 ['zero-tangent', { vx: 0, vz: 0 }],
 ['no-normal', { speed: 0, branch: 'no-normal' }],
];
export const cases = Object.freeze(definitions.map(([id, values]) => Object.freeze({ ...base, ...values, half: Object.freeze([...(values.half ?? base.half)]), id })));
export const gates = Object.freeze({ velocity: 1e-10, omega: 1e-10, impulse: 1e-10, momentum: 1e-10, angularMomentum: 1e-10, geometry: 1e-10, energy: 1e-10, work: 1e-10, slip: 1e-10, tangentPlane: 1e-12 });
// Finite20 + repeat1 + recording2 + known2 + unknown2 Worlds.
// Finite20 + repeat1 + recording4(includes replay1) + known4 + unknown2 steps.
export const budget = Object.freeze({ worlds: 27, acceptedSteps: 31, maxWorlds: 40, maxAcceptedSteps: 128, maxEvidenceBytes: 16 * 1024 * 1024 });
