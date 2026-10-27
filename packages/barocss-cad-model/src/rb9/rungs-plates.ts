// RB9 rungs 4 and 7 (O70), scoped (O74): the geometry the studio can judge today, and what waits for the kernel lane named.
// 4, a machined plate: its corner holes on their pitch (exact axes), the central pocket's size and depth (exact planes),
// its vertical corner radii (exact cylinders), the volume's closed form; machinable (O87): the CNC milling report —
// CNC2–CNC4's holes, corners, cavities, access and setups, no rule failed or undecided (the brief states no material, so
// material and wall are not judged).
// 7, a lap joint: two plates mated, their clearance holes on one pattern and coaxial (exact axes), every hole ≥ 1.5 Ø from
// its plate's edges (the brief's rule), no interference; the bolt itself waits for R12c's fasteners.
import { treeOfDoc } from '../chat/robot';
import type { BodyResult } from '../engine/evaluate';
import { assemblyBodies, checkAssembly } from '../team/assembly';
import type { Call, Outcome, Params, Rung } from './core';
import { axisDistance, boxIs, cylindersOf, holds, near, parallel, volumeOf } from './measure';
import { boundsOf } from '../engine/bounds';
import { machinability } from '../machining/report';
import { processProfile } from '../library/materials';

const num = (p: Params, k: string) => p[k] as number;
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): Call => ({ tool: 'run_command', args: { command, values, ...sel } });
const Z: [number, number, number] = [0, 0, 1];
/** A rule the rung does not judge yet: soft, never passed, its lane named. */
const held = (id: string, why: string): Outcome => ({ id, hard: false, pass: false, measured: 'held', expected: why });

/** O87: machinable — the CNC milling report on the part: no rule failed or undecided but material and wall, which need the material the brief does not state, stock, which needs the shop's list (O102), and the stages not built yet (said so in their reasons); warnings kept in what was measured. */
function machinable(doc: Parameters<typeof machinability>[0], bodies: Parameters<typeof machinability>[1]): Outcome {
  const r = machinability(doc, bodies, processProfile('cnc-milling')!), judged = r.rules.filter(x => x.id !== 'material' && x.id !== 'wall' && x.id !== 'stock' && !/is not built yet/.test(x.why ?? ''));
  const bad = judged.filter(x => x.status === 'fail' || x.status === 'unknown'), warned = judged.filter(x => x.status === 'warn');
  return { id: 'machinable', hard: true, pass: !bad.length, measured: { failed: bad.map(x => `${x.id}: ${x.status}`), warned: warned.map(x => x.id) }, expected: 'cnc-milling: no rule failed or undecided (material and wall not judged: the brief states no material; stock not judged: the brief loads no stock list (CNC7b); the stages not built yet not judged)' };
}
// ——— 4. the machined plate
const CORNERS: readonly [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const plate = (p: Params, o: { moved?: boolean; depth?: number; rc?: number; holes?: number; extra?: boolean; L?: number } = {}): Call[] => {
  const L = o.L ?? num(p, 'L'), W = num(p, 'W'), T = num(p, 'T'), a = num(p, 'a'), b = num(p, 'b'), dep = o.depth ?? num(p, 'depth');
  const c: Call[] = [cmd('box', { w: L, d: W, h: T, x: 0, y: 0, z: 0 })];
  CORNERS.slice(0, o.holes ?? 4).forEach(([sx, sy], k) => c.push(cmd('hole', { d: num(p, 'dh'), x: num(p, 'L') / 2 + sx * num(p, 'px') / 2 + (k === 0 && o.moved ? 1 : 0), y: W / 2 + sy * num(p, 'py') / 2 }, { faces: ['n1.top'] })));
  const n = (o.holes ?? 4) + 2, tool = `n${n + 1}`;
  c.push(cmd('box', { w: a, d: b, h: dep + 1, x: (num(p, 'L') - a) / 2, y: (W - b) / 2, z: T - dep }), cmd('difference', {}, { bodies: [`b${n - 1}`, `b${n + 1}`] }));
  c.push(cmd('fillet', { radius: o.rc ?? num(p, 'rc') }, { edges: [0, 1, 2, 3].map(k => ({ between: [`${tool}.side${k}`, `${tool}.side${(k + 1) % 4}`] })) }));
  if (o.extra) c.push(cmd('hole', { type: 'blind', d: 3, depth: 2, x: 3, y: W / 2 }, { faces: ['n1.top'] }));
  return c;
};
export const RUNG4: Rung = {
  n: 4, id: 'machined-plate', title: 'machined plate (geometry)',
  space: [{ key: 'L', lo: 80, hi: 200, step: 5 }, { key: 'W', lo: 50, hi: 150, step: 5 }, { key: 'T', lo: 6, hi: 20, step: 1 }, { key: 'dh', lo: 4, hi: 10, step: 0.5 },
    { key: 'px', lo: p => num(p, 'L') - 40, hi: p => num(p, 'L') - 4 * num(p, 'dh'), step: 1 }, { key: 'py', lo: p => num(p, 'W') - 30, hi: p => num(p, 'W') - 4 * num(p, 'dh'), step: 1 },
    { key: 'rc', lo: 3, hi: 8, step: 0.5 }, { key: 'a', lo: p => 3 * num(p, 'rc'), hi: p => num(p, 'px') - num(p, 'dh') - 10, step: 1 }, { key: 'b', lo: p => 3 * num(p, 'rc'), hi: p => num(p, 'py') - num(p, 'dh') - 10, step: 1 },
    { key: 'depth', lo: 2, hi: p => num(p, 'T') - 2, step: 0.5 }],
  prompt: p => `A machined plate ${p.L} × ${p.W} × ${p.T} mm, its corner at the origin: four Ø${p.dh} mm through holes on a ${p.px} × ${p.py} mm pitch centred on it, and a pocket in the middle of its top, ${p.a} × ${p.b} mm and ${p.depth} mm deep, its vertical corners rounded ${p.rc} mm.`,
  scripted: p => plate(p),
  async check({ doc, bodies }, p) {
    const L = num(p, 'L'), W = num(p, 'W'), T = num(p, 'T'), a = num(p, 'a'), b = num(p, 'b'), dep = num(p, 'depth'), rc = num(p, 'rc'), r = num(p, 'dh') / 2, cyl = cylindersOf(bodies);
    const holes = CORNERS.map(([sx, sy]) => cyl.find(c => Math.abs(c.r - r) <= 1e-9 && parallel(c.a, Z) && axisDistance(c, [L / 2 + sx * num(p, 'px') / 2, W / 2 + sy * num(p, 'py') / 2, 0]) <= 1e-9 && Math.abs(c.zMax - c.zMin - T) <= 1e-4));
    const holeCount = cyl.filter(c => Math.abs(c.r - r) <= 1e-9 && parallel(c.a, Z)).length;
    // (The pocket from exact planes inside the plate: its floor facing up, its walls facing in.)
    const planes = bodies.flatMap(x => x.mesh.faces.flatMap(f => f.exact?.kind === 'plane' ? [f.exact] : []));
    const inside = (k: number, v: number, hi: number) => v > 1e-6 && v < hi - 1e-6;
    const floor = planes.filter(e => Math.abs(e.n[2] - 1) <= 1e-9 && inside(2, e.o[2], T)).map(e => e.o[2]);
    const wall = (k: number, s: number, hi: number) => planes.filter(e => Math.abs(e.n[k] - s) <= 1e-9 && inside(k, e.o[k], hi)).map(e => e.o[k]);
    const x0 = wall(0, 1, L), x1 = wall(0, -1, L), y0 = wall(1, 1, W), y1 = wall(1, -1, W);
    const size = x0.length === 1 && x1.length === 1 && y0.length === 1 && y1.length === 1 ? [x1[0] - x0[0], y1[0] - y0[0]] : null;
    const pocketOk = !!size && Math.abs(size[0] - a) <= 1e-9 && Math.abs(size[1] - b) <= 1e-9 && Math.abs(size[0] / 2 + x0[0] - L / 2) <= 1e-9 && Math.abs(size[1] / 2 + y0[0] - W / 2) <= 1e-9 && floor.length === 1 && Math.abs(T - floor[0] - dep) <= 1e-9;
    // (Its corners: the vertical cylinders that are not holes, one at each corner, inset by their radius.)
    const corners = CORNERS.map(([sx, sy]) => cyl.find(c => Math.abs(c.r - r) > 1e-9 && parallel(c.a, Z) && axisDistance(c, [L / 2 + sx * (a / 2 - c.r), W / 2 + sy * (b / 2 - c.r), 0]) <= 1e-9));
    const vol = L * W * T - 4 * Math.PI * r * r * T - (a * b - (4 - Math.PI) * rc * rc) * dep;
    return [boxIs('box', bodies, [L, W, T]), holds('solids', bodies.length === 1, bodies.length, 'one solid'),
      holds('holes', holes.every(Boolean) && holeCount === 4, [holes.map(Boolean), holeCount], `four Ø${2 * r} through holes on the ${p.px} × ${p.py} pitch (axes to 1e-9)`),
      holds('pocket', pocketOk, { size, floor, depth: floor.length ? T - floor[0] : null }, `a ${a} × ${b} pocket ${dep} deep, centred (exact planes to 1e-9)`),
      holds('corners', corners.every(c => !!c && c.r >= rc - 1e-9), corners.map(c => c?.r ?? null), `its four vertical corners rounded ≥ ${rc}`),
      near('volume', volumeOf(bodies), vol, 1e-9, true), machinable(doc, bodies)];
  },
  mutants: [
    { id: 'moved', target: 'holes', why: 'one hole 1 mm off its pitch', calls: p => plate(p, { moved: true }) },
    { id: 'three', target: 'holes', why: 'three holes', calls: p => plate(p, { holes: 3 }) },
    { id: 'deep', target: 'pocket', why: 'the pocket 1 mm deeper', calls: p => plate(p, { depth: num(p, 'depth') + 1 }) },
    { id: 'sharp', target: 'corners', why: 'corner radius 1', calls: p => plate(p, { rc: 1 }) },
    { id: 'extra', target: 'volume', why: 'a stray Ø3 blind hole', calls: p => plate(p, { extra: true }) },
    { id: 'long', target: 'box', why: 'the plate 5 mm longer', calls: p => plate(p, { L: num(p, 'L') + 5 }) },
    { id: 'loose', target: 'solids', why: 'a loose block', calls: p => [...plate(p), cmd('box', { w: 5, d: 5, h: 5, x: num(p, 'L') + 10, y: 0, z: 0 })] },
    { id: 'deep-hole', target: 'machinable', why: 'a Ø0.5 blind hole T − 1 deep (over 6 × d: failed)', calls: p => [...plate(p), cmd('hole', { type: 'blind', d: 0.5, depth: num(p, 'T') - 1, x: 3, y: num(p, 'W') / 2 }, { faces: ['n1.top'] })] },
    // (A groove round the first corner hole, inside the plate: its step behind the bore reached by no straight tool.)
    { id: 'groove', target: 'machinable', why: 'an internal groove round a corner hole (undecided reach, unreached area)', calls: p => [...plate(p), cmd('cylinder', { r: num(p, 'dh') / 2 + 1.5, h: 2, x: num(p, 'L') / 2 - num(p, 'px') / 2, y: num(p, 'W') / 2 - num(p, 'py') / 2, z: num(p, 'T') / 2 - 1 }), cmd('difference', {}, { bodies: ['b9', 'b11'] })] },
  ],
};

// ——— 7. the lap joint: plate A fixed, plate B lapped over its end, on one hole pattern
const holesAt = (p: Params, x0: number, o: { sy?: number; edge?: boolean } = {}): [number, number][] => {
  const W = num(p, 'W'), d = num(p, 'd'), sy = o.edge ? W - 2 * d : o.sy ?? num(p, 'sy'), xs = num(p, 'nx') === 2 ? [x0 - num(p, 'sx') / 2, x0 + num(p, 'sx') / 2] : [x0];
  return xs.flatMap(x => [[x, W / 2 - sy / 2], [x, W / 2 + sy / 2]] as [number, number][]);
};
const lap = (p: Params, o: { off?: boolean; edge?: boolean; sy?: number; nub?: boolean; ymate?: boolean } = {}): Call[] => {
  const LA = num(p, 'LA'), LB = num(p, 'LB'), W = num(p, 'W'), t = num(p, 't'), ov = num(p, 'ov'), d = num(p, 'd');
  const part = (id: string, name: string, l: number, at: [number, number][], grounded: boolean): Call[] => [{ tool: 'add_part', args: { name, ...(grounded ? { grounded: true } : {}) } },
    { tool: 'run_command', args: { part: id, command: 'box', values: { w: l, d: W, h: t, x: 0, y: 0, z: 0 } } },
    ...at.map(([x, y]) => ({ tool: 'run_command', args: { part: id, command: 'hole', values: { d, x, y }, faces: ['n1.top'] } }))];
  const bHoles = holesAt(p, ov / 2, o).map(([x, y], k) => [k === holesAt(p, ov / 2).length - 1 && o.off ? x + 1 : x, y] as [number, number]);
  const c: Call[] = [...part('p1', 'Plate A', LA, holesAt(p, LA - ov / 2, o), true), ...part('p2', 'Plate B', LB, bHoles, false)];
  // (A nub under plate B, 1 mm into plate A clear of the holes: the plates interfere.)
  if (o.nub) c.push({ tool: 'run_command', args: { part: 'p2', command: 'box', values: { w: 2, d: 2, h: 1, x: 1, y: 1, z: -1 } } }, { tool: 'run_command', args: { part: 'p2', command: 'union', values: {}, bodies: ['b2', 'b4'].map(k => k === 'b2' ? `b${holesAt(p, 0).length + 1}` : `b${holesAt(p, 0).length + 3}`) } });
  c.push({ tool: 'add_mate', args: { kind: 'coincident', a: { part: 'p1', face: 'n1.top' }, b: { part: 'p2', face: 'n1.bottom' } } },
    { tool: 'add_mate', args: { kind: 'concentric', a: { part: 'p1', face: 'n2.side0' }, b: { part: 'p2', face: 'n2.side0' } } });
  if (o.ymate !== false) c.push({ tool: 'add_mate', args: { kind: 'distance', a: { part: 'p1', face: 'origin:xz' }, b: { part: 'p2', face: 'origin:xz' }, distance: 0 } });
  return c;
};
/** The vertical exact cylinders of radius r in a part's placed bodies: their axis points. */
const boresOf = (bodies: readonly BodyResult[], r: number) => cylindersOf(bodies).filter(c => Math.abs(c.r - r) <= 1e-9 && parallel(c.a, Z));
export const RUNG7: Rung = {
  n: 7, id: 'lap-joint', title: 'bolted lap joint (plates)',
  space: [{ key: 'd', lo: 4.5, hi: 9, step: 0.5 }, { key: 'nx', choice: [1, 2] as never }, { key: 't', lo: 3, hi: 10, step: 1 },
    { key: 'W', lo: p => 6 * num(p, 'd') + 5, hi: 120, step: 1 }, { key: 'sy', lo: p => 2 * num(p, 'd'), hi: p => num(p, 'W') - 3 * num(p, 'd'), step: 0.5 },
    { key: 'sx', lo: p => 2 * num(p, 'd'), hi: p => 6 * num(p, 'd'), step: 0.5 }, { key: 'ov', lo: p => (num(p, 'nx') === 2 ? num(p, 'sx') : 0) + 3 * num(p, 'd'), hi: p => (num(p, 'nx') === 2 ? num(p, 'sx') : 0) + 6 * num(p, 'd'), step: 0.5 },
    { key: 'LA', lo: p => num(p, 'ov') + 20, hi: 200, step: 5 }, { key: 'LB', lo: p => num(p, 'ov') + 20, hi: 200, step: 5 }],
  prompt: p => `A lap joint of two plates, each its own part placed by mates: plate A ${p.LA} × ${p.W} × ${p.t} mm, fixed, its corner at the origin; plate B ${p.LB} × ${p.W} × ${p.t} mm lying on A's top, lapped ${p.ov} mm over A's far end (x = ${num(p, 'LA') - num(p, 'ov')} to ${p.LA}), flush with it across. Through both, Ø${p.d} mm clearance holes for the bolts, ${num(p, 'nx') * 2} of them on one pattern centred in the lap: ${num(p, 'nx') === 2 ? `two columns ${p.sx} mm apart` : 'one column'}, two rows ${p.sy} mm apart. Every hole at least 1.5 × its Ø from its plate's edges. The bolts themselves come later.`,
  scripted: p => lap(p),
  async check({ doc }, p, evaluate) {
    const insts = doc.instances ?? [], placed = await assemblyBodies(doc, evaluate), r = num(p, 'd') / 2, LA = num(p, 'LA'), ov = num(p, 'ov');
    const parts = insts.map(i => placed.get(i.id) ?? []), want = holesAt(p, LA - ov / 2);
    const tree = await treeOfDoc(doc, [], evaluate), gate = await checkAssembly(doc, evaluate);
    const bores = parts.map(b => boresOf(b, r)), [A, B] = bores;
    const aligned = parts.length === 2 && A.length === want.length && B.length === want.length && A.every(a => B.some(b => axisDistance(b, a.c) <= 1e-9));
    const pattern = parts.length === 2 && want.every(([x, y]) => A.some(c => axisDistance(c, [x, y, 0]) <= 1e-9));
    // (Each hole's axis from its own plate's sides, by the plate's box: at least 1.5 Ø.)
    const edge = parts.map((b, k) => { const bx = b.length ? boundsOf(b) : null; return bx ? Math.min(...bores[k].map(c => Math.min(c.c[0] - bx.min[0], bx.max[0] - c.c[0], c.c[1] - bx.min[1], bx.max[1] - c.c[1]))) : -Infinity; });
    return [
      holds('plates', parts.length === 2 && parts.every(b => b.length === 1), parts.map(b => b.length), 'two plates, one solid each'),
      holds('mated', !tree.problems.length && tree.joints.every(j => j.type === 'fixed') && insts.every(i => tree.joints.some(j => j.child === i.id)), { joints: tree.joints.map(j => [j.key, j.type]), problems: tree.problems.map(x => x.code) }, 'plate B fixed to plate A by its mates'),
      holds('pattern', pattern, A?.map(c => c.c.slice(0, 2)) ?? null, `plate A's ${want.length} holes on the brief's pattern (axes to 1e-9)`),
      holds('aligned', aligned, [A?.length, B?.length], 'every hole of A coaxial with one of B (1e-9)'),
      holds('edges', edge.length === 2 && edge.every(e => e >= 1.5 * num(p, 'd') - 1e-9), edge, `every hole ≥ ${1.5 * num(p, 'd')} mm (1.5 Ø) from its plate's edges`),
      holds('contacts', gate.verdict === 'pass', gate.findings.filter(f => f.code !== 'EXPECTED_CONTACT').map(f => f.code), 'no interference; only the mates\' contact'),
      held('bolt', 'the bolts wait for R12c\'s fasteners (kernel lane)'),
    ];
  },
  mutants: [
    { id: 'off', target: 'aligned', why: 'one of B\'s holes 1 mm off', calls: p => lap(p, { off: true }) },
    { id: 'edge', target: 'edges', why: 'the rows 1 Ø from the plates\' sides', calls: p => lap(p, { edge: true }) },
    { id: 'spread', target: 'pattern', why: 'both plates\' rows 2 mm further apart', calls: p => lap(p, { sy: num(p, 'sy') + 2 }) },
    { id: 'nub', target: 'contacts', why: 'a nub under B, 1 mm into A', calls: p => lap(p, { nub: true }) },
    { id: 'turns', target: 'mated', why: 'B on one bolt hole, free to turn', calls: p => lap(p, { ymate: false }) },
    { id: 'one', target: 'plates', why: 'plate B never added', calls: p => lap(p).filter(c => !JSON.stringify(c.args).includes('"p2"') && !(c.tool === 'add_part' && (c.args as { name: string }).name === 'Plate B')) },
  ],
};
