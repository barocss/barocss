// FR3a (D125): writes conformance/fr/'s corner cases, every expected value by closed form here (not by the kernel).
// node scripts/fr3a-conformance.mjs [dir]   (default: conformance/fr)
import { writeFileSync } from 'node:fs';
const dir = process.argv[2] ?? new URL('../conformance/fr', import.meta.url).pathname;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const write = (name, c) => writeFileSync(`${dir}/${name}.json`, JSON.stringify({ id: `fr-${name}`, step: 'FR', decisions: ['D125'], ...c }, null, 2) + '\n');
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, A = 1600 - 34 * 34, I = (40 ** 4 - 34 ** 4) / 12;
{ // a mitred rectangle: each member's section run from x = y to L − y along it (y across, towards the outside < 0)
  const points = [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0]], segments = [[0, 1], [1, 2], [2, 3], [3, 0]];
  // The centroid across: −2I/(L·A) towards the outside (∫∫ y(L − 2y) dA / (L·A)); along: the middle.
  const off = L => 2 * I / (L * A);
  const centroids = [[300, -off(600), 0], [600 + off(400), 200, 0], [300, 400 + off(600), 0], [-off(400), 200, 0]], lengths = [600, 400, 600, 400];
  write('frame-rectangle-mitre', { about: 'FR3a: a 600 × 400 rectangle of sharp 40 × 40 × 3 tubes mitred at every corner: A·L each (a prism cut by planes through the corners), the centroid moved outwards by 2I/(L·A), 45° ends.',
    input: { partDocument: D([{ id: 'f', kind: 'frame', points, segments, section: SHARP, corners: { default: 'mitre' } }]) },
    expect: { outputs: segments.map(([i, j], k) => ({ volumeMM3: { value: A * lengths[k], relTol: 1e-9 }, centroidMM: { value: centroids[k], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }],
      member: { areaMM2: A, lengthMM: lengths[k], centroid: [0, 0], ends: [{ end: 'start', kind: 'mitre', point: i, angleDegrees: 45 }, { end: 'end', kind: 'mitre', point: j, angleDegrees: 45 }], derived: { innerRadius: 'sharp: 0, as the outer corners' }, absTol: 1e-9 } })), stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: across the member at y (towards the inside > 0) it runs from y to L − y, so V = ∫(L − 2y)dA = A·L and ȳ = −2I/(L·A), I = (b⁴ − (b − 2t)⁴)/12; θ = 45°.' });
}
{ // a butt at 60°: member 0 along +X runs through, member 1 comes in at 60° and ends on its face y = 20
  const phi = Math.PI / 3, L = 300, P = [400, 0, 0], F = [400 - L * Math.cos(phi), L * Math.sin(phi), 0], run = 20 * Math.sin(phi), c0 = L - 20 / Math.sin(phi), cot = Math.cos(phi) / Math.sin(phi);
  const inO = [Math.cos(phi), -Math.sin(phi), 0], xO = [Math.sin(phi), Math.cos(phi), 0];
  // Member 1 at ξ across (along its x): it runs s ∈ [0, c0 + ξ·cot φ] from F. V = A·c0; s̄ = (A c0² + cot²φ I)/(2V); ξ̄ = cot φ I / V.
  const V1 = A * c0, s = (A * c0 * c0 + cot * cot * I) / (2 * V1), xi = cot * I / V1;
  const c1 = [0, 1, 2].map(k => F[k] + s * inO[k] + xi * xO[k]);
  write('frame-butt-60', { about: 'FR3a: two sharp 40 × 40 × 3 tubes meeting at 60°, butted: the through member runs on (b/2)·sin φ, the other ends on its face — (b/2)/sin φ short along its line, its centroid by the cut prism\'s moments.',
    input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], P, F], segments: [[0, 1], [2, 1]], section: SHARP, corners: { at: [{ point: 1, kind: 'butt', through: 0 }] } }]) },
    expect: { outputs: [
      { volumeMM3: { value: A * (400 + run), relTol: 1e-9 }, centroidMM: { value: [(400 + run) / 2, 0, 0], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }], member: { areaMM2: A, lengthMM: 400, centroid: [0, 0], ends: [{ end: 'start', kind: 'square', point: 0 }, { end: 'end', kind: 'through', point: 1 }], absTol: 1e-9 } },
      { volumeMM3: { value: V1, relTol: 1e-9 }, centroidMM: { value: c1, absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }], member: { areaMM2: A, lengthMM: L, centroid: [0, 0], ends: [{ end: 'start', kind: 'square', point: 2 }, { end: 'end', kind: 'butt', point: 1, angleDegrees: 30 }], absTol: 1e-9 } },
    ], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: the through member A(400 + 20 sin φ), square both ends; the butted one cut by y = 20 — s_end(ξ) = L − 20/sin φ + ξ cot φ — so V = A(L − 20/sin φ), s̄ = (A c0² + cot²φ·I)/(2V), ξ̄ = cot φ·I/V; its cut 90° − φ from square.' });
}
write('refuse-mitre-sections-differ', { about: 'FR3a: a mitre between a sharp tube and a round-cornered one is refused by name (their cut faces would not meet face to face).',
  input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 300, 0]], segments: [[0, 1], [1, 2]], section: SHARP, overrides: [{ member: 1, section: { ...SHARP, outerRadius: 6 } }], corners: { default: 'mitre' } }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[MITRE_SECTIONS_DIFFER] point 1: members 0 and 1' } }, oracle: 'By construction: the two sections differ.' });
write('refuse-corner-not-a-joint', { about: 'FR3a: a mitre asked at a point where three members end is refused by name (an ordered trim is FR3b).',
  input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 300, 0], [300, 0, 300]], segments: [[0, 1], [1, 2], [1, 3]], section: SHARP, corners: { at: [{ point: 1, kind: 'mitre' }] } }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[CORNER_NOT_A_JOINT] point 1: 3 member ends meet there' } }, oracle: 'By construction.' });
