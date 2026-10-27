// FR4a (D127): writes conformance/fr/'s cut-list cases, every expected value by closed form here (not by the kernel).
// node scripts/fr4a-conformance.mjs [dir]   (default: conformance/fr)
import { writeFileSync } from 'node:fs';
const dir = process.argv[2] ?? new URL('../conformance/fr', import.meta.url).pathname;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const write = (name, c) => writeFileSync(`${dir}/${name}.json`, JSON.stringify({ id: `fr-${name}`, step: 'FR', decisions: ['D127'], ...c }, null, 2) + '\n');
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, A = 1600 - 34 * 34, I = (40 ** 4 - 34 ** 4) / 12, RHO = 7850;
{ // the mitred rectangle (as fr-frame-rectangle-mitre) and its cut list
  const off = L => 2 * I / (L * A), lengths = [600, 400, 600, 400], points = [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0]], segments = [[0, 1], [1, 2], [2, 3], [3, 0]];
  const centroids = [[300, -off(600), 0], [600 + off(400), 200, 0], [300, 400 + off(600), 0], [-off(400), 200, 0]];
  const mitre = { kind: 'mitre', mitre: 45, bevel: 0 };
  write('cutlist-rectangle-mitre', { about: 'FR4a: the cut list of a mitred 600 × 400 rectangle of sharp 40 × 40 × 3 tubes (steel 7850 kg/m³, a test value): two rows of two, axis lengths 600 and 400, long points L + 40, 45° both ends, mass ρ·A·L.',
    input: { partDocument: D([{ id: 'f', kind: 'frame', points, segments, section: SHARP, corners: { default: 'mitre' } }]) },
    expect: { outputs: segments.map((_, k) => ({ volume: { value: A * lengths[k], relTol: 1e-9 }, centroid: { value: centroids[k], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }] })),
      cutList: { density: RHO, absTol: 1e-9, rows: [
        { quantity: 2, pieces: ['f/0', 'f/2'], axisLength: 600, longPoint: 640, fromVolume: false, ends: [mitre, mitre], mass: RHO * A * 600e-9 },
        { quantity: 2, pieces: ['f/1', 'f/3'], axisLength: 400, longPoint: 440, fromVolume: false, ends: [mitre, mitre], mass: RHO * A * 400e-9 },
      ], totals: { quantity: 4, axisLength: 2000, mass: RHO * A * 2000e-9 } } },
    oracle: 'Closed forms: the mitre planes through the corners on the centroidal lines, so the axis length is the segment\'s; long point L + b; 45° about the section\'s y; mass ρ·A·L.' });
}
{ // a 60° butt and its cut list
  const phi = Math.PI / 3, L = 300, P = [400, 0, 0], F = [400 - L * Math.cos(phi), L * Math.sin(phi), 0], run = 20 * Math.sin(phi), Lc = L - 20 / Math.sin(phi), cot = Math.cos(phi) / Math.sin(phi);
  const inO = [Math.cos(phi), -Math.sin(phi), 0], xO = [Math.sin(phi), Math.cos(phi), 0], V1 = A * Lc, sb = (A * Lc * Lc + cot * cot * I) / (2 * V1), xi = cot * I / V1;
  const c1 = [0, 1, 2].map(k => F[k] + sb * inO[k] + xi * xO[k]);
  write('cutlist-butt-60', { about: 'FR4a: the cut list of two sharp tubes butted at 60°: the through piece 400 + 20 sin 60° square, the other 300 − 20/sin 60° with its end cut 30° (long point L_c + 20 tan 30°).',
    input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], P, F], segments: [[0, 1], [2, 1]], section: SHARP, corners: { at: [{ point: 1, kind: 'butt', through: 0 }] } }]) },
    expect: { outputs: [{ volume: { value: A * (400 + run), relTol: 1e-9 }, centroid: { value: [(400 + run) / 2, 0, 0], absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }] },
      { volume: { value: A * Lc, relTol: 1e-9 }, centroid: { value: c1, absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus: 1 }] }],
      cutList: { density: RHO, absTol: 1e-9, rows: [
        { quantity: 1, pieces: ['f/0'], axisLength: 400 + run, longPoint: 400 + run, fromVolume: false, ends: [{ kind: 'square', mitre: 0, bevel: 0 }, { kind: 'through', mitre: 0, bevel: 0 }], mass: RHO * A * (400 + run) * 1e-9 },
        { quantity: 1, pieces: ['f/1'], axisLength: Lc, longPoint: Lc + 20 * Math.tan(Math.PI / 6), fromVolume: false, ends: [{ kind: 'square', mitre: 0, bevel: 0 }, { kind: 'butt', mitre: 30, bevel: 0 }], mass: RHO * A * Lc * 1e-9 },
      ], totals: { quantity: 2, axisLength: 400 + run + Lc, mass: RHO * A * (400 + run + Lc) * 1e-9 } } },
    oracle: 'Closed forms: the through piece runs on (b/2) sin φ; the butted one ends (b/2)/sin φ short of the corner on its line, its cut 90° − φ about its y; mass ρ·A·L. (Its centroid as fr-frame-butt-60: the cut prism\'s moments.)' });
}
