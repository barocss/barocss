// RB9 rungs 12 and 14 (O70): assemblies placed by mates. The checker reads the assembly as the studio solves it: each
// part's box where the mates put it, the joint tree (RM1) for every part's freedoms, the assembly gate (A8.4) for parts
// meeting or touching undeclared, the mass against its closed form, the BOM view's rows.
import { robotCheckOfDoc, robotOfDoc, treeOfDoc, urdfOfDoc } from '../chat/robot';
import { forwardKinematics } from '../robot/fk';
import { treeInertia } from '../robot/inertia';
import { readUrdf, urdfFk } from '../robot/urdfCheck';
import { workspaceMap } from '../robot/workspace';
import type { Duty } from '../robot/harness';
import { materialData } from '../library/materials';
import { assemblyBodies, bomView, checkAssembly } from '../team/assembly';
import { prng, type Call, type Evaluate, type Outcome, type Params, type Rung } from './core';
import { boxOf, cylindersOf, holds, near } from './measure';
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';

const num = (p: Params, k: string) => p[k] as number;
const cmd = (part: string, command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): Call => ({ tool: 'run_command', args: { part, command, values, ...sel } });
const mate = (kind: string, a: [string, string], b: [string, string], extra: Record<string, unknown> = {}): Call => ({ tool: 'add_mate', args: { kind, a: { part: a[0], face: a[1] }, b: { part: b[0], face: b[1] }, ...extra } });
const sameBox = (a: { min: readonly number[]; max: readonly number[] } | null, min: readonly number[], max: readonly number[], tol = 1e-4) => !!a && [0, 1, 2].every(k => Math.abs(a.min[k] - min[k]) <= tol && Math.abs(a.max[k] - max[k]) <= tol);

// ——— 12. the 5-part assembly: a base plate, two brackets, a shaft turning in their bores, a cap
const FC = 0.25;
/** The five parts' boxes where the brief puts them: base, bracket A, bracket B, cap, shaft. */
function boxes12(p: Params): { name: string; min: number[]; max: number[] }[] {
  const P = num(p, 'P'), Q = num(p, 'Q'), tb = num(p, 'tb'), bw = num(p, 'bw'), bd = num(p, 'bd'), bh = num(p, 'bh'), ds = num(p, 'ds'), c = num(p, 'c'), zc = num(p, 'zc'), ct = num(p, 'ct'), xa = num(p, 'xa'), xb = num(p, 'xb');
  const y0 = (Q - bd) / 2, z = tb + zc;
  return [{ name: 'base', min: [0, 0, 0], max: [P, Q, tb] }, { name: 'bracket A', min: [xa, y0, tb], max: [xa + bw, y0 + bd, tb + bh] }, { name: 'bracket B', min: [xb, y0, tb], max: [xb + bw, y0 + bd, tb + bh] },
    { name: 'cap', min: [xb + bw, Q / 2 - c / 2, z - c / 2], max: [xb + bw + ct, Q / 2 + c / 2, z + c / 2] }, { name: 'shaft', min: [xa, Q / 2 - ds / 2, z - ds / 2], max: [xb + bw - 1, Q / 2 + ds / 2, z + ds / 2] }];
}
const asm5 = (p: Params, o: { axial?: boolean; shaft?: number; cap?: boolean; bw?: number; xb?: number; steel?: boolean } = {}): Call[] => {
  const Q = num(p, 'Q'), bd = num(p, 'bd'), bw = o.bw ?? num(p, 'bw'), ds = num(p, 'ds'), c = num(p, 'c'), zc = num(p, 'zc'), xa = num(p, 'xa'), xb = o.xb ?? num(p, 'xb'), ct = num(p, 'ct');
  // (A bracket on the base: flush on its top, its origin planes the brief's distances from the base's.)
  const onBase = (part: string, x: number): Call[] => [mate('coincident', ['p1', 'n1.top'], [part, 'n1.bottom']), mate('distance', ['p1', 'origin:yz'], [part, 'origin:yz'], { distance: x }), mate('distance', ['p1', 'origin:xz'], [part, 'origin:xz'], { distance: (Q - bd) / 2 })];
  const c12: Call[] = [{ tool: 'add_part', args: { name: 'Base', grounded: true } }, cmd('p1', 'box', { w: num(p, 'P'), d: Q, h: num(p, 'tb'), x: 0, y: 0, z: 0 }),
    { tool: 'add_part', args: { name: 'Bracket A' } }, cmd('p2', 'box', { w: bw, d: bd, h: num(p, 'bh'), x: 0, y: 0, z: 0 }), cmd('p2', 'hole', { d: ds + 2 * FC, x: bd / 2, y: zc }, { faces: ['n1.side1'] }),
    ...onBase('p2', xa), { tool: 'add_part', args: { name: 'Bracket B', copy_of: 'p2' } }, ...onBase('p3', xb)];
  if (o.cap !== false) c12.push({ tool: 'add_part', args: { name: 'Cap' } }, cmd('p4', 'box', { w: ct, d: c, h: c, x: 0, y: 0, z: 0 }),
    mate('coincident', ['p3', 'n1.side1'], ['p4', 'n1.side3']), mate('distance', ['p3', 'origin:xz'], ['p4', 'origin:xz'], { distance: (bd - c) / 2 }), mate('distance', ['p3', 'origin:xy'], ['p4', 'origin:xy'], { distance: zc - c / 2 }));
  // (The shaft: in bracket A's bore, its end flush with A's outer face, 1 mm short of the cap — it turns, nothing else.)
  const sh = o.cap === false ? 'p4' : 'p5';
  c12.push({ tool: 'add_part', args: { name: 'Shaft' } }, cmd(sh, 'cylinder', { r: (o.shaft ?? ds) / 2, h: xb + bw - 1 - xa, x: 0, y: 0, z: 0 }), mate('concentric', ['p2', 'n2.side0'], [sh, 'n1.side0']));
  if (o.steel !== false) c12.push({ tool: 'set_material', args: { part: sh, material: 'steel' } });
  if (o.axial !== false) c12.push(mate('coincident', ['p2', 'n1.side3'], [sh, 'n1.top'], { flip: true }));
  return c12;
};
export const RUNG12: Rung = {
  n: 12, id: 'five-part-assembly', title: '5-part assembly',
  space: [{ key: 'P', lo: 100, hi: 200, step: 5 }, { key: 'Q', lo: 50, hi: 100, step: 5 }, { key: 'tb', lo: 4, hi: 10, step: 1 }, { key: 'bw', lo: 8, hi: 15, step: 1 },
    { key: 'bd', lo: 20, hi: p => Math.min(40, num(p, 'Q') - 10), step: 1 }, { key: 'bh', lo: 30, hi: 60, step: 1 }, { key: 'ds', lo: 6, hi: 12, step: 1 },
    { key: 'c', lo: p => num(p, 'ds') + 6, hi: p => num(p, 'bd'), step: 1 }, { key: 'zc', lo: p => num(p, 'c') / 2 + 1, hi: p => num(p, 'bh') - num(p, 'c') / 2, step: 0.5 }, { key: 'ct', lo: 3, hi: 6, step: 1 },
    { key: 'xa', lo: 5, hi: p => num(p, 'P') / 2 - num(p, 'bw') - 10, step: 1 }, { key: 'xb', lo: p => num(p, 'P') / 2 + 10, hi: p => num(p, 'P') - num(p, 'bw') - num(p, 'ct') - 5, step: 1 }],
  prompt: p => `An assembly of five parts, each its own part placed by mates: the shaft steel, the others aluminium 6061. A base plate ${p.P} × ${p.Q} × ${p.tb} mm, fixed, its corner at the origin. Two brackets, blocks ${p.bw} × ${p.bd} × ${p.bh} mm (x × y × z), standing on the base centred across it, ${p.xa} and ${p.xb} mm from its x = 0 end; each has a bore along x, Ø${num(p, 'ds') + 2 * FC} mm, ${p.zc} mm above its bottom, centred across. A Ø${p.ds} mm shaft runs in the bores from bracket A's outer face (flush) to 1 mm short of bracket B's outer face, free to turn and nothing else. A cap ${p.ct} × ${p.c} × ${p.c} mm on bracket B's outer face, centred on the bore. Every other part fixed.`,
  scripted: p => asm5(p),
  async check({ doc }, p, evaluate) {
    const want = boxes12(p), insts = doc.instances ?? [], placed = await assemblyBodies(doc, evaluate), Q = num(p, 'Q'), z = num(p, 'tb') + num(p, 'zc');
    // (Each part the brief names, matched by where it is — not by its name or id.)
    const match = want.map(w => insts.find(i => sameBox(boxOf(placed.get(i.id) ?? []), w.min, w.max))?.id ?? null);
    const tree = await treeOfDoc(doc, [], evaluate), shaft = match[4];
    const moving = tree.joints.filter(j => j.type !== 'fixed'), sj = moving[0];
    const onAxis = !!sj && Math.abs(Math.abs(sj.axis[0]) - 1) <= 1e-9 && Math.abs(sj.origin[1] - Q / 2) <= 1e-6 && Math.abs(sj.origin[2] - z) <= 1e-6;
    const gate = await checkAssembly(doc, evaluate), bom = await bomView(doc, evaluate);
    const rho = materialData('al6061')!.densityGPerCm3 / 1000, steel = materialData('steel')!.densityGPerCm3 / 1000, bore = Math.PI * (num(p, 'ds') / 2 + FC) ** 2, [bw, bd, bh, c, ct] = ['bw', 'bd', 'bh', 'c', 'ct'].map(k => num(p, k));
    const mass = rho * (num(p, 'P') * Q * num(p, 'tb') + 2 * (bw * bd * bh - bore * bw) + ct * c * c) + steel * Math.PI * (num(p, 'ds') / 2) ** 2 * (num(p, 'xb') + bw - 1 - num(p, 'xa'));
    const out: Outcome[] = [
      holds('parts', insts.length === 5 && bom.parts.length === 5 && bom.parts.every(x => x.massG > 0), [insts.length, bom.parts.length], 'five parts, five BOM rows with their masses'),
      holds('placed', match.every(Boolean) && new Set(match).size === 5, Object.fromEntries(want.map((w, k) => [w.name, match[k]])), 'every part where the brief puts it (its box to 1e-4)'),
      holds('freedoms', !tree.problems.length && !tree.loops.length && insts.every(i => tree.joints.some(j => j.child === i.id)) && moving.length === 1 && (sj.type === 'continuous' || sj.type === 'revolute') && sj.child === shaft && onAxis,
        { joints: tree.joints.map(j => [j.key, j.type]), problems: tree.problems.map(x => x.code), loops: tree.loops.length }, 'one turn, the shaft\'s about the bore axis; every other part fixed'),
      holds('contacts', gate.verdict === 'pass', gate.findings.filter(f => f.code !== 'EXPECTED_CONTACT').map(f => f.code), 'no parts meeting; only the mates\' contacts'),
      near('mass', gate.massG, mass, 5e-3),
    ];
    return out;
  },
  mutants: [
    { id: 'unmated', target: 'freedoms', why: 'the shaft with no axial mate: it slides too', calls: p => asm5(p, { axial: false }) },
    { id: 'meet', target: 'contacts', why: 'the shaft 1 mm over the bore', calls: p => asm5(p, { shaft: num(p, 'ds') + 2 * FC + 1 }) },
    { id: 'missing', target: 'parts', why: 'no cap', calls: p => asm5(p, { cap: false }) },
    { id: 'aluminium-shaft', target: 'mass', why: 'the shaft left aluminium', calls: p => asm5(p, { steel: false }) },
    { id: 'thick', target: 'mass', why: 'the brackets 2 mm thicker', calls: p => asm5(p, { bw: num(p, 'bw') + 2 }) },
    { id: 'moved', target: 'placed', why: 'bracket B 5 mm further along', calls: p => asm5(p, { xb: num(p, 'xb') + 5 }) },
  ],
};

// ——— 14. the 2-axis arm (the owner's rung): two turns about vertical axes, a payload at the tip, sized for a duty
// (Bars on a base plate, as RM's chain-2r: each turns on a bore over the one below; the payload a steel block 40 × 40 on
// the forearm's tip bore, as tall as its mass needs — its material set with set_material, O73.)
const LP = (m: number) => m * 1e6 / (materialData('steel')!.densityGPerCm3 * 1600);
const J1 = 'base~p1', J2 = 'p1~p2';
const dutyOf = (p: Params): Duty => ({ moves: [{ from: {}, to: { [J1]: num(p, 'q1'), [J2]: num(p, 'q2') }, profile: 'trapezoid', limits: { velocity: num(p, 'v'), acceleration: num(p, 'acc') }, dwell_s: 0.5 }], life_h: 20000 });
const arm2 = (p: Params, o: { l2?: number; effort?: number; elbowFixed?: boolean; payload?: boolean; rated?: boolean; steel?: boolean } = {}): Call[] => {
  const l1 = num(p, 'l1'), l2 = o.l2 ?? num(p, 'l2'), e = o.effort ?? 20, top = (part: string | null, x: number) => cmd(part as string, 'hole', { d: 10, x, y: 0 }, { faces: ['n1.top'] });
  const bar = (part: string, name: string, l: number): Call[] => [{ tool: 'add_part', args: { name } }, cmd(part, 'box', { w: l + 20, d: 20, h: 5, x: -10, y: -10, z: 0 }), top(part, 0), top(part, l)];
  const c: Call[] = [{ tool: 'run_command', args: { command: 'box', values: { w: 60, d: 60, h: 10, x: -30, y: -30, z: 0 } } }, { tool: 'run_command', args: { command: 'hole', values: { d: 10, x: 0, y: 0 }, faces: ['n1.top'] } },
    ...bar('p1', 'Upper arm', l1), ...bar('p2', 'Forearm', l2),
    mate('concentric', ['base', 'n2.side0'], ['p1', 'n2.side0']), mate('coincident', ['base', 'n1.top'], ['p1', 'n1.bottom']),
    mate('concentric', ['p1', 'n3.side0'], ['p2', 'n2.side0']), mate('coincident', ['p1', 'n1.top'], ['p2', 'n1.bottom']),
    { tool: 'add_part', args: { name: 'Payload' } }, cmd('p3', 'box', { w: 40, d: 40, h: LP(num(p, 'm')), x: -20, y: -20, z: 0 })];
  if (o.steel !== false) c.push({ tool: 'set_material', args: { part: 'p3', material: 'steel' } });
  if (o.payload !== false) c.push(mate('coincident', ['p2', 'n1.top'], ['p3', 'n1.bottom']), mate('distance', ['p2', 'origin:yz'], ['p3', 'origin:yz'], { distance: l2 }), mate('distance', ['p2', 'origin:xz'], ['p3', 'origin:xz'], { distance: 0 }));
  const rating = o.rated === false ? { lower: -2.5, upper: 2.5 } : { lower: -2.5, upper: 2.5, effort: e, velocity: 5 };
  c.push({ tool: 'set_joints', args: { joints: { [J1]: rating, [J2]: rating } } });
  if (o.elbowFixed) c.push(mate('angle', ['p1', 'n1.side0'], ['p2', 'n1.side0'], { angle: 0 }));
  return c;
};
/** RM2's forward kinematics against the exported URDF's own composition, each link in the root's frame (m): the worst gap over the poses. */
function urdfFkGap(tree: Awaited<ReturnType<typeof treeOfDoc>>, r: Extract<Awaited<ReturnType<typeof urdfOfDoc>>, { ok: true }>, poses: number, seed: number): number {
  const { model } = readUrdf(r.urdf), W = r.frames, root = W.get(tree.base)!, rand = prng(seed), keys = tree.joints.filter(j => j.type !== 'fixed' && !j.mimic).map(j => j.key);
  let worst = 0;
  for (let k = 0; k < poses; k++) {
    const q = Object.fromEntries(keys.map(key => [key, (rand() * 2 - 1) * 2.5])), fk = forwardKinematics(tree, q), u = urdfFk(model, Object.fromEntries(Object.entries(fk.values).map(([key, v]) => [r.names.joints[key], v])));
    for (const l of tree.links) {
      const D = fk.motions.get(l.id)!, H = W.get(l.id)!, U = u.get(r.names.links[l.id]); if (!U) return Infinity;
      const o = [0, 1, 2].map(i => D.R[i * 3] * H.o[0] + D.R[i * 3 + 1] * H.o[1] + D.R[i * 3 + 2] * H.o[2] + D.t[i]), R = [0, 1, 2].flatMap(i => [0, 1, 2].map(j => D.R[i * 3] * H.R[j] + D.R[i * 3 + 1] * H.R[3 + j] + D.R[i * 3 + 2] * H.R[6 + j]));
      for (let i = 0; i < 3; i++) {
        worst = Math.max(worst, Math.abs((root.R[i] * (o[0] - root.o[0]) + root.R[3 + i] * (o[1] - root.o[1]) + root.R[6 + i] * (o[2] - root.o[2])) / 1000 - U.t[i]));
        for (let j = 0; j < 3; j++) worst = Math.max(worst, Math.abs(root.R[i] * R[j] + root.R[3 + i] * R[3 + j] + root.R[6 + i] * R[6 + j] - U.R[i * 3 + j]));
      }
    }
  }
  return worst;
}
/** The exported inertials against RM3's (mass, centre, inertia about it, link frame, SI): the worst gap. */
function urdfInertiaGap(model: ReturnType<typeof readUrdf>['model'], r: Extract<Awaited<ReturnType<typeof urdfOfDoc>>, { ok: true }>, rm3: ReturnType<typeof treeInertia>): number {
  let worst = 0;
  for (const li of rm3) {
    if (!li.part) continue;
    const u = model.links.find(l => l.name === r.names.links[li.link])?.inertial; if (!u) return Infinity;
    const I = li.inertia, mine = [li.massKg, ...li.comM, I[0], I[1], I[2], I[4], I[5], I[8]], theirs = [u.mass, ...u.xyz, ...u.I];
    for (let k = 0; k < mine.length; k++) worst = Math.max(worst, Math.abs(mine[k] - theirs[k]));
  }
  return worst;
}
async function bodiesOfDoc(doc: StudioDoc, evaluate: Evaluate): Promise<BodyResult[]> { const e = await evaluate(doc); return e.ok ? e.bodies : []; }
export const RUNG14: Rung = {
  n: 14, id: 'two-axis-arm', title: '2-axis robot arm',
  space: [{ key: 'l1', lo: 80, hi: 250, step: 5 }, { key: 'l2', lo: 80, hi: 250, step: 5 }, { key: 'm', lo: 0.1, hi: 1, step: 0.05 },
    { key: 'R', lo: p => Math.max(num(p, 'l1'), num(p, 'l2')) + 30, hi: p => num(p, 'l1') + num(p, 'l2') - 10, step: 1 },
    { key: 'q1', lo: 0.5, hi: 1.5, step: 0.1 }, { key: 'q2', lo: -2, hi: -0.5, step: 0.1 }, { key: 'v', lo: 1, hi: 3, step: 0.5 }, { key: 'acc', lo: 5, hi: 20, step: 1 }],
  prompt: p => `A 2-axis arm, each its own part placed by mates, aluminium 6061 but the payload. A base plate 60 × 60 × 10 mm, its centre at the origin, with a Ø10 mm bore through its middle. An upper arm and a forearm, bars 20 mm wide and 5 mm thick with a Ø10 mm bore at each end, ${p.l1} and ${p.l2} mm between their bores; each turns about a vertical axis on its first bore over the bore below it (the upper arm on the base's, the forearm on the upper arm's far one), flat on the part below. A ${p.m} kg payload, a steel block 40 × 40 mm standing on the forearm centred on its far bore. The far bore must reach ${p.R} mm from the base axis. Both joints turn ±2.5 rad, with effort and velocity ratings for this duty: from 0 to ${p.q1} and ${p.q2} rad, a trapezoid at ${p.v} rad/s and ${p.acc} rad/s², 0.5 s dwells at each end, 20 000 h. Export it as URDF.`,
  scripted: p => arm2(p),
  async check({ doc }, p, evaluate) {
    const bodies = await bodiesOfDoc(doc, evaluate), tree = await treeOfDoc(doc, bodies, evaluate), turns = tree.joints.filter(j => j.type !== 'fixed');
    const vertical = turns.every(j => Math.abs(Math.abs(j.axis[2]) - 1) <= 1e-9), [sh, el] = turns;
    // (The tool point: the end link's bore farthest from the elbow axis, at the shoulder's height — reach in the plane.)
    let reach: number | null = null;
    if (turns.length === 2 && vertical && !tree.problems.length) {
      const placed = await assemblyBodies(doc, evaluate), end = tree.links.find(l => l.id === el.child)?.part ?? null;
      const bores = end ? cylindersOf(placed.get(end) ?? []).filter(c => Math.abs(c.r - 5) <= 1e-9 && Math.abs(Math.abs(c.a[2]) - 1) <= 1e-9) : [];
      const far = bores.sort((a, b) => Math.hypot(b.c[0] - el.origin[0], b.c[1] - el.origin[1]) - Math.hypot(a.c[0] - el.origin[0], a.c[1] - el.origin[1]))[0];
      if (far) reach = workspaceMap(tree, { link: el.child, tool: [far.c[0], far.c[1], sh.origin[2]], samples: 2000, h: 5 }).reach;
    }
    // (The payload's mass as RM3 reads it: the link fixed to the end link, its material the part's own.)
    const rm3 = treeInertia(tree, (await robotOfDoc(doc, bodies, evaluate)).partOf), fixedOn = tree.joints.find(j => j.type === 'fixed' && el && j.parent === el.child);
    const payload = fixedOn ? rm3.find(l => l.link === fixedOn.child)?.massKg ?? null : null;
    const harness = await robotCheckOfDoc(doc, bodies, evaluate, dutyOf(p));
    const u = await urdfOfDoc(doc, bodies, evaluate, 'arm');
    let fk = Infinity, inertia = Infinity, issues: string[] = ['not exported'];
    if (u.ok) { const rd = readUrdf(u.urdf, new Set(u.files.map(f => f.path))); issues = rd.issues; fk = urdfFkGap(tree, u, 20, 14); inertia = urdfInertiaGap(rd.model, u, rm3); }
    return [
      holds('joints', !tree.problems.length && turns.length === 2 && turns.every(j => j.type === 'revolute') && vertical && Math.hypot(el.origin[0] - sh.origin[0], el.origin[1] - sh.origin[1]) - num(p, 'l1') <= 1e-6 && Math.hypot(el.origin[0] - sh.origin[0], el.origin[1] - sh.origin[1]) - num(p, 'l1') >= -1e-6,
        { joints: tree.joints.map(j => [j.key, j.type]), problems: tree.problems.map(x => x.code) }, `two revolute joints about vertical axes, ${p.l1} mm apart`),
      holds('reach', reach !== null && reach >= num(p, 'R'), reach, `the far bore reaches ≥ ${p.R} mm (RM9b's map, 2000 poses)`),
      near('payload', payload, num(p, 'm'), 1e-9, true),
      holds('margins', harness.ok && Object.keys(harness.actuators).length === 2, { least: harness.least, unknowns: harness.unknowns.map(x => x.code) }, 'every RD9 margin above 0 at the duty, an RD3 pair on each joint'),
      holds('urdf', u.ok && !issues.length && fk <= 1e-9 && inertia <= 1e-12, { ok: u.ok, issues, fk, inertia }, 'the URDF exports clean; its FK equals RM2\'s to 1e-9 at 20 poses, its inertials RM3\'s to 1e-12'),
    ] as Outcome[];
  },
  mutants: [
    { id: 'short', target: 'reach', why: 'the forearm too short for the reach', calls: p => arm2(p, { l2: num(p, 'R') - num(p, 'l1') - 10 }) },
    { id: 'aluminium-payload', target: 'payload', why: 'the payload block left aluminium', calls: p => arm2(p, { steel: false }) },
    { id: 'weak', target: 'margins', why: 'the joints rated 0.001 N·m: the motors too small for the move', calls: p => arm2(p, { effort: 0.001 }) },
    { id: 'elbow-fixed', target: 'joints', why: 'the elbow held by an angle mate', calls: p => arm2(p, { elbowFixed: true }) },
    { id: 'loose-payload', target: 'joints', why: 'the payload unmated: a part not connected', calls: p => arm2(p, { payload: false }) },
    { id: 'unrated', target: 'urdf', why: 'the joints\' range set, their effort and velocity not: the URDF needs them', calls: p => arm2(p, { rated: false }) },
  ],
};
