// FR3b (D126): writes conformance/fr/'s ordered-trim, T-joint and trim cases, every expected value by closed form here.
// node scripts/fr3b-conformance.mjs [dir]   (default: conformance/fr)
import { writeFileSync } from 'node:fs';
const dir = process.argv[2] ?? new URL('../conformance/fr', import.meta.url).pathname;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const write = (name, c) => writeFileSync(`${dir}/${name}.json`, JSON.stringify({ id: `fr-${name}`, step: 'FR', decisions: ['D126'], ...c }, null, 2) + '\n');
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, A = 1600 - 34 * 34, I = (40 ** 4 - 34 ** 4) / 12, L = 300;
const out = (V, c, ends) => ({ volumeMM3: { value: V, relTol: 1e-9 }, centroidMM: { value: c, absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }], member: { areaMM2: A, lengthMM: L, centroid: [0, 0], ends, absTol: 1e-9 } });
write('frame-ordered-corner', { about: 'FR3b: three sharp tubes ending at one corner, an ordered trim (the same section: by index) — X runs on 20 to cover the others, Y is trimmed to X\'s envelope, Z to X\'s and Y\'s: square ends, A·L each by its centroidal line.',
  input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [L, 0, 0], [0, L, 0], [0, 0, L]], segments: [[1, 0], [2, 0], [3, 0]], section: SHARP, corners: { multi: 'order' } }]) },
  expect: { outputs: [
    out(A * (L + 20), [(L - 20) / 2, 0, 0], [{ end: 'start', kind: 'square', point: 1 }, { end: 'end', kind: 'through', point: 0 }]),
    out(A * (L - 20), [0, (L + 20) / 2, 0], [{ end: 'start', kind: 'square', point: 2 }, { end: 'end', kind: 'trim', point: 0 }]),
    out(A * (L - 20), [0, 0, (L + 20) / 2], [{ end: 'start', kind: 'square', point: 3 }, { end: 'end', kind: 'trim', point: 0 }]),
  ], stepRoundTrip: { relTol: 1e-9 } },
  oracle: 'Closed forms: X from −20 to 300, Y and Z from 20 to 300 — square ends, so A·L and the centroids the lines\' midpoints.' });
write('frame-tee-butt', { about: 'FR3b: a rail ending on a post\'s middle (a T-joint), butted on its face: the post A·800 untouched, the rail A·480 from the face at x 20.',
  input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [0, 0, 400], [500, 0, 400]], segments: [[0, 1], [3, 2]], section: SHARP, corners: { tee: 'butt' } }]) },
  expect: { outputs: [
    { ...out(A * 800, [0, 0, 400], [{ end: 'start', kind: 'square', point: 0 }, { end: 'end', kind: 'square', point: 1 }]), member: { areaMM2: A, lengthMM: 800, centroid: [0, 0], absTol: 1e-9 } },
    { ...out(A * 480, [260, 0, 400], [{ end: 'start', kind: 'square', point: 3 }, { end: 'end', kind: 'butt', point: 2, angleDegrees: 0 }]), member: { areaMM2: A, lengthMM: 500, centroid: [0, 0], ends: [{ end: 'start', kind: 'square', point: 3 }, { end: 'end', kind: 'butt', point: 2, angleDegrees: 0 }], absTol: 1e-9 } },
  ], stepRoundTrip: { relTol: 1e-9 } },
  oracle: 'Closed forms: the rail runs x 20 to 500, the post z 0 to 800, both square.' });
{ // a leg trimmed to an inclined floor z = 0.2x + 10 at its start
  const V = 490 * A, zbar = (A * (500 ** 2 - 100) - 0.04 * I) / (2 * V), xbar = -0.2 * I / V;
  write('frame-trim-plane', { about: 'FR3b: a sharp tube leg from z 0 to 500, its start trimmed to the plane z = 0.2x + 10 (run on to meet it, the floor\'s side cut off): A·490, its centroid by the cut prism\'s moments.',
    input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 500]], segments: [[0, 1]], section: SHARP, trims: [{ member: 0, end: 'start', plane: { origin: [0, 0, 10], normal: [-0.2, 0, 1] } }] }]) },
    expect: { outputs: [{ volumeMM3: { value: V, relTol: 1e-9 }, centroidMM: { value: [xbar, 0, zbar], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }],
      member: { areaMM2: A, lengthMM: 500, centroid: [0, 0], ends: [{ end: 'start', kind: 'trim', point: 0, angleDegrees: Math.atan(0.2) * 180 / Math.PI }], absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: at x across the section it runs from 0.2x + 10 to 500, so V = 490A, x̄ = −0.2 I/V, z̄ = (A(500² − 10²) − 0.04 I)/(2V), I = (40⁴ − 34⁴)/12.' });
}
write('refuse-butt-on-open-side', { about: 'FR3b: a tube butted on a round-cornered tube\'s face is refused by name: its end spans 40, the face\'s flat only 28 (a gap at the rounds; trim it to the envelope instead).',
  input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [400, 0, 0], [400, 300, 0]], segments: [[0, 1], [1, 2]], section: { ...SHARP, outerRadius: 6 }, corners: { at: [{ point: 1, kind: 'butt', through: 0 }] } }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[BUTT_ON_OPEN_SIDE] point 1: member 1 meets member 0: its end spans -20 to 20' } }, oracle: 'By construction: the flat side from −14 to 14.' });
write('refuse-members-clash', { about: 'FR3b: two members crossing inside both their lengths are refused by name.',
  input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [400, 0, 0], [200, -200, 0], [200, 200, 0]], segments: [[0, 1], [2, 3]], section: SHARP, corners: {} }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[MEMBERS_CLASH] members 0 and 1 cross inside both their lengths' } }, oracle: 'By construction: they cross at (200, 0, 0).' });
