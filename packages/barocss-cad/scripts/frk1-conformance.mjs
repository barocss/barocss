// FRk1 (D165): writes conformance/frk/'s gusset and end-cap cases, every expected value by closed form here.
// node scripts/frk1-conformance.mjs [dir]   (default: conformance/frk)
import { writeFileSync } from 'node:fs';
const dir = process.argv[2] ?? new URL('../conformance/frk', import.meta.url).pathname;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const write = (name, c) => writeFileSync(`${dir}/${name}.json`, JSON.stringify({ id: `frk-${name}`, step: 'FRk', decisions: ['D165'], ...c }, null, 2) + '\n');
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, A = 1600 - 34 * 34, K = 4 - Math.PI;
const solid = (V, c, genus) => ({ volumeMM3: { value: V, relTol: 1e-9 }, centroidMM: { value: c, absTol: 1e-9 }, bodies: 1, topology: [{ shells: 1, genus }] });
/** A polygon's area and centroid by the shoelace (its corners in order). */
function polygon(P) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length], w = x0 * y1 - x1 * y0; a += w; cx += (x0 + x1) * w; cy += (y0 + y1) * w; }
  return { area: Math.abs(a) / 2, c: [cx / (3 * a), cy / (3 * a)] };
}
{ // A butted L of sharp tubes (the rail through: the same sections, so the lower index), a clipped gusset in its corner.
  const g = polygon([[35, 20], [140, 20], [20, 120], [20, 35]]);
  write('gusset-butt-l', { about: 'FRk1: a clipped gusset (legs 120 and 100, clip 15, 5 thick) in a butted L of sharp tubes — on the rail\'s top (z 20) and the post\'s face (x 20), centred on y 0: (l₁l₂ − c²)/2·t, its centroid the clipped triangle\'s; the rail through, run on 20 (A·620), the post butted on its top (A·580).',
    input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section: SHARP, corners: { default: 'butt' } }, { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [120, 100], thickness: 5, clip: 15 }]) },
    expect: { outputs: [solid(A * 620, [290, 0, 0], 1), solid(A * 580, [0, 0, 310], 1),
      { ...solid(g.area * 5, [g.c[0], 0, g.c[1]], 0), plate: { kind: 'gusset', areaMM2: g.area, seams: [105, 85], absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: the shoelace on the clipped triangle (35, 20), (140, 20), (20, 120), (20, 35) in (x, z); the tubes square-cut prisms.' });
}
{ // A round-cornered tube capped over its top and plugged in its foot.
  const env = 1600 - K * 36, bore = 34 * 34 - K * 9, Ab = env - bore;
  write('end-caps-over-inset', { about: 'FRk1: a 40 × 40 × 3 tube (ro 6) from z 0 to 300, a cap 4 thick over its top (its outline, A_env·4) and a plug 6 deep in its bore at its foot (A_bore·6, flush); the seams the loops\' perimeters.',
    input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 300]], segments: [[0, 1]], section: { ...SHARP, outerRadius: 6 } },
      { id: 'top', kind: 'end-cap', frame: 'f', member: 0, end: 'end', fit: 'over', thickness: 4 }, { id: 'foot', kind: 'end-cap', frame: 'f', member: 0, end: 'start', fit: 'inset', thickness: 6 }]) },
    expect: { outputs: [solid(Ab * 300, [0, 0, 150], 1),
      { ...solid(env * 4, [0, 0, 302], 0), plate: { kind: 'endCap', areaMM2: env, seam: 160 - 48 + 12 * Math.PI, absTol: 1e-9 } },
      { ...solid(bore * 6, [0, 0, 3], 0), plate: { kind: 'endCap', areaMM2: bore, seam: 136 - 24 + 6 * Math.PI, absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: a rounded square\'s area 4h² − (4 − π)r² and perimeter 8h − 8r + 2πr (outline h 20, r 6; bore h 17, r 3).' });
}
write('refuse-gusset-fit', { about: 'FRk1: a gusset on round tubes is refused by name: no flat face under it.',
  input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section: { kind: 'round-tube', diameter: 40, wall: 3 }, corners: { default: 'mitre' } }, { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [100, 100], thickness: 5 }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[GUSSET_FIT] member 0 has no flat face under the gusset' } }, oracle: 'By construction: a round tube has no straight side.' });
write('refuse-cap-end', { about: 'FRk1: a cap on a mitred end is refused by name: a cap sits on a square end.',
  input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section: SHARP, corners: { default: 'mitre' } }, { id: 'c', kind: 'end-cap', frame: 'f', member: 1, end: 'start', fit: 'over', thickness: 4 }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[CAP_END] member 1\'s start is cut by a mitre' } }, oracle: 'By construction: the corner is mitred.' });
