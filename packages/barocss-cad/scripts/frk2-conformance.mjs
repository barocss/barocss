// FRk2 (D166): writes conformance/frk/'s weld-bead cases, every expected value by closed form here.
// node scripts/frk2-conformance.mjs [dir]   (default: conformance/frk)
import { writeFileSync } from 'node:fs';
const dir = process.argv[2] ?? new URL('../conformance/frk', import.meta.url).pathname;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const write = (name, c) => writeFileSync(`${dir}/${name}.json`, JSON.stringify({ id: `frk-${name}`, step: 'FRk', decisions: ['D166'], ...c }, null, 2) + '\n');
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, A = 1600 - 34 * 34, WIDE = { kind: 'rect-tube', width: 80, height: 80, wall: 4, outerRadius: 0 }, AW = 6400 - 72 * 72, z = 3;
const solid = (V, c, topology) => ({ volume: { value: V, relTol: 1e-9 }, centroid: { value: c, absTol: 1e-9 }, bodies: topology.length, topology });
const g0 = { shells: 1, genus: 0 }, g1 = { shells: 1, genus: 1 };
/** A polygon's area and centroid by the shoelace (its corners in order). */
function polygon(P) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length], w = x0 * y1 - x1 * y0; a += w; cx += (x0 + x1) * w; cy += (y0 + y1) * w; }
  return { area: Math.abs(a) / 2, c: [cx / (3 * a), cy / (3 * a)] };
}
const tee = (post, rail) => ({ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400]], segments: [[0, 1], [2, 3]], section: post, ...(rail ? { overrides: [{ member: 1, section: rail }] } : {}), corners: { tee: 'butt' } });
{ // A sharp rail butted on a wider post's face (x 40): the bead all round.
  const V = 160 * z * z / 2 + 4 / 3 * z ** 3, h = (160 * z ** 3 / 6 + z ** 4 / 3) / V;
  write('bead-tee-wide-post', { about: 'FRk2: a fillet bead (leg 3) round a 40 × 40 rail\'s end butted on an 80 × 80 post\'s face: the outline offset by the leg, drafted 45°, less the rail — P·z²/2 + (4/3)z³, its centroid (P·z³/6 + z⁴/3)/V off the face.',
    input: { partDocument: D([tee(WIDE, SHARP), { id: 'w', kind: 'weld-bead', frame: 'f', on: { member: 1, end: 'end' }, leg: z }]) },
    expect: { outputs: [solid(AW * 800, [0, 0, 400], [g1]), solid(A * 460, [270, 0, 400], [g1]), { ...solid(V, [40 + h, 0, 400], [g1]), bead: { leg: z, seam: 160, flush: 0, meets: [0], absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: the offset areas A₀ + P·s + 4s² integrated over the leg; the rail from the post\'s face at x 40 to 500.' });
}
write('bead-tee-flush', { about: 'FRk2: a bead on a 40 × 40 rail butted on a 40 × 40 post: its sides flush with the post\'s face edges take no fillet — the top and bottom runs only, z²/2 a mm, two bodies; flush 80 of its 160.',
  input: { partDocument: D([tee(SHARP), { id: 'w', kind: 'weld-bead', frame: 'f', on: { member: 1, end: 'end' }, leg: z }]) },
  expect: { outputs: [solid(A * 800, [0, 0, 400], [g1]), solid(A * 480, [260, 0, 400], [g1]), { ...solid(40 * z * z, [20 + z / 3, 0, 400], [g0, g0]), bead: { leg: z, seam: 160, flush: 80, meets: [0], absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
  oracle: 'Closed forms: two right-triangle prisms of legs 3, 40 long, at z 420 and 380; their centroid a third of the leg off the face.' });
{ // A gusset's beads in a butted L.
  const VA = 105 * z * z, VB = 85 * z * z, V = VA + VB, gp = polygon([[35, 20], [140, 20], [20, 120], [20, 35]]);
  write('bead-gusset', { about: 'FRk2: the beads of a clipped gusset (legs 120 and 100, clip 15, 5 thick) in a butted L: both seams, both faces, (l − c)·z² a seam, four bodies; their centroid the four prisms\'.',
    input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section: SHARP, corners: { default: 'butt' } }, { id: 'g', kind: 'gusset', frame: 'f', point: 1, legs: [120, 100], thickness: 5, clip: 15 }, { id: 'w', kind: 'weld-bead', frame: 'f', on: { gusset: 'g' }, leg: z }]) },
    expect: { outputs: [solid(A * 620, [290, 0, 0], [g1]), solid(A * 580, [0, 0, 310], [g1]), solid(gp.area * 5, [gp.c[0], 0, gp.c[1]], [g0]), { ...solid(V, [(VA * 87.5 + VB * (20 + z / 3)) / V, 0, (VA * (20 + z / 3) + VB * 77.5) / V], [g0, g0, g0, g0]), bead: { leg: z, seam: 380, flush: 0, meets: [0, 1], absTol: 1e-9 } }], stepRoundTrip: { relTol: 1e-9 } },
    oracle: 'Closed forms: four right-triangle prisms of legs 3; seam A 105 long on z 20, x 35 to 140; seam B 85 long on x 20, z 35 to 120.' });
}
write('refuse-bead-mitre', { about: 'FRk2: a bead on a mitred end is refused by name: a mitre takes a groove weld (its seam only).',
  input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section: SHARP, corners: { default: 'mitre' } }, { id: 'w', kind: 'weld-bead', frame: 'f', on: { member: 0, end: 'end' }, leg: z }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[BEAD_KIND] member 0\'s end is mitred' } }, oracle: 'By construction.' });
write('refuse-bead-angle', { about: 'FRk2: a bead on a brace butted at 60° from square is refused by name: fillets on oblique ends are not modelled yet.',
  input: { partDocument: D([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [300, 0, 400 + 300 * Math.sqrt(3)], [0, 0, 400]], segments: [[0, 1], [2, 3]], section: WIDE, overrides: [{ member: 1, section: SHARP }], corners: { tee: 'butt' } }, { id: 'w', kind: 'weld-bead', frame: 'f', on: { member: 1, end: 'end' }, leg: z }]) },
  expect: { error: { code: 'PARAMETER', messageIncludes: '[BEAD_ANGLE] member 1\'s end meets its face at 60° from square' } }, oracle: 'By construction: the brace 30° off the post\'s axis.' });
