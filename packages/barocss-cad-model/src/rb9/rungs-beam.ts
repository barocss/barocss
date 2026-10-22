// RB9 rung 6 (O70, O73): a load bracket by closed-form beam theory only (CAE and FEM are off the roadmap, #2177). A wall
// plate and a prismatic cantilever arm, a tip load, a metal body; the checker cuts the arm at its root, middle and tip
// (beam.ts: Green's theorem on the kernel's cut face) and judges the Euler–Bernoulli beam on those sections:
// σ = F·L·c / I ≤ σy / 2 and δ = F·L³ / (3 E I) ≤ δmax, where the theory holds (L/h ≥ 5), with the root filleted.
// Not judged (stated in the report): stress concentration beyond the factor, contact at the wall, flange buckling.
import { materialIdOf } from '../app/bodies';
import { materialData } from '../library/materials';
import { beamSection, type BeamSection } from './beam';
import type { Call, Outcome, Params, Rung } from './core';
import { cylindersOf, holds } from './measure';

const num = (p: Params, k: string) => p[k] as number;
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): Call => ({ tool: 'run_command', args: { command, values, ...sel } });
const LABEL: Record<string, string> = { al6061: 'aluminium 6061', steel: 'steel' };
const PLATE = 100, ZC = 50;
const mat = (p: Params) => materialData(p.m as string)!;
/** The depth the brief needs: safety factor 2 on yield and the tip deflection, on the 0.5 mm grid (a rectangle, b wide). */
export function depthFor(p: Params, only?: 'stress'): number {
  const L = num(p, 'L'), b = num(p, 'b'), F = num(p, 'F'), { yieldMPa: sy, elasticModulusMPa: E } = mat(p);
  const hs = Math.sqrt(12 * F * L / (b * sy)), hd = Math.cbrt(4 * F * L ** 3 / (E * b * num(p, 'dmax')));
  return Math.ceil(2 * (only ? hs : Math.max(hs, hd))) / 2;
}
const bracket = (p: Params, o: { h?: number; L?: number; step?: boolean; fillet?: boolean; m?: string } = {}): Call[] => {
  const L = o.L ?? num(p, 'L'), b = num(p, 'b'), h = o.h ?? depthFor(p), r = Math.ceil(2 * 0.25 * h) / 2, m = o.m ?? p.m as string;
  const c: Call[] = [{ tool: 'set_brief', args: { fields: { purpose: { value: 'a wall bracket carrying a load at its tip', basis: 'stated', source: 'wall bracket' }, process: { value: 'cnc-milling', basis: 'stated', source: 'machined' },
    material: { value: m, basis: 'stated', source: `in ${LABEL[p.m as string]}` } } } },
  cmd('box', { w: 10, d: PLATE, h: PLATE, x: -10, y: -PLATE / 2, z: 0 })];
  // (A stepped arm, the far half 0.8 deep: not prismatic.)
  if (o.step) c.push(cmd('box', { w: L / 2, d: b, h, x: 0, y: -b / 2, z: ZC - h / 2 }), cmd('box', { w: L / 2, d: b, h: 0.8 * h, x: L / 2, y: -b / 2, z: ZC - 0.4 * h }), cmd('union', {}, { bodies: ['b1', 'b3'] }), cmd('union', {}, { bodies: ['b6', 'b5'] }));
  else c.push(cmd('box', { w: L, d: b, h, x: 0, y: -b / 2, z: ZC - h / 2 }), cmd('union', {}, { bodies: ['b1', 'b3'] }));
  if (o.fillet !== false) c.push(cmd('fillet', { radius: r }, { edges: [{ between: ['n1.side1', 'n3.top'] }, { between: ['n1.side1', 'n3.bottom'] }] }));
  return c;
};
export const RUNG6: Rung = {
  n: 6, id: 'load-bracket', title: 'load bracket (beam)',
  space: [{ key: 'L', lo: 40, hi: 150, step: 5 }, { key: 'b', lo: 10, hi: 30, step: 1 }, { key: 'm', choice: ['al6061', 'steel'] },
    // (Feasible as a slender beam: the stress depth under 0.16 L, so L/h ≥ 5 with the 0.5 mm grid.)
    { key: 'F', lo: 20, hi: p => Math.min(500, Math.floor(num(p, 'b') * mat(p).yieldMPa * 0.0256 * num(p, 'L') / 12)), step: 1 },
    { key: 'dmax', lo: p => Math.ceil(100 * 4 * num(p, 'F') / (mat(p).elasticModulusMPa * num(p, 'b') * 0.004096)) / 100, hi: p => Math.ceil(100 * 3 * 4 * num(p, 'F') / (mat(p).elasticModulusMPa * num(p, 'b') * 0.004096)) / 100, step: 0.01 }],
  prompt: p => `A wall bracket, machined in ${LABEL[p.m as string]}: a wall plate ${PLATE} × ${PLATE} × 10 mm, its face at x = 0 and centred on y = 0, z = ${ZC}, and a straight cantilever arm from it along +x, a rectangle ${p.b} mm wide, ${p.L} mm long from the plate's face, centred on it. It carries ${p.F} N down at its tip. Size its depth for a safety factor of 2 on yield and at most ${p.dmax} mm deflection at the tip, slender enough for beam theory (L/h ≥ 5), and round its root's top and bottom edges by at least a quarter of the depth.`,
  scripted: p => bracket(p),
  async check({ doc, bodies }, p, evaluate) {
    const body = bodies.length === 1 ? bodies[0] : null, F = num(p, 'F'), m = mat(p);
    if (!body) return [holds('body', false, bodies.length, 'one body: the plate and its arm')];
    const L = body.mesh.bounds.max[0];
    // (The root: past its fillets — the farthest fillet axis — where the arm is prismatic; the moment taken at the wall, F·L.)
    const fillets = cylindersOf([body]).filter(c => Math.abs(Math.abs(c.a[1]) - 1) <= 1e-9 && c.c[0] > 0 && c.c[0] < L / 2);
    const x0 = Math.max(0, ...fillets.map(c => c.c[0])) + 0.01, at = [x0, L / 2, L - 0.01];
    const cuts = await Promise.all(at.map(x => beamSection(doc, body, evaluate, x)));
    const [root, mid, tip] = cuts, ok = cuts.every(s => typeof s !== 'string'), S = root as BeamSection;
    const same = (a: BeamSection, b: BeamSection) => Math.abs(a.Iy - b.Iy) <= 1e-9 * Math.abs(a.Iy) && Math.abs(a.area - b.area) <= 1e-9 * a.area;
    const sigma = ok ? F * L * S.c / S.Iy : null, delta = ok ? F * L ** 3 / (3 * m.elasticModulusMPa * S.Iy) : null;
    const top = fillets.filter(c => ok && c.c[2] > S.cz), bottom = fillets.filter(c => ok && c.c[2] < S.cz), rMin = ok ? 0.25 * S.depth : Infinity;
    return [
      holds('body', true, 1, 'one body: the plate and its arm'),
      holds('material', materialIdOf(doc, body) === p.m, materialIdOf(doc, body) ?? null, `${p.m}, as stated`),
      holds('prismatic', ok && same(S, mid as BeamSection) && same(S, tip as BeamSection), cuts.map(s => typeof s === 'string' ? s : [s.area, s.Iy]), 'root, middle and tip sections equal (I to 1e-9)'),
      holds('slender', ok && L / S.depth >= 5, ok ? L / S.depth : null, 'L/h ≥ 5 (Euler–Bernoulli)'),
      holds('fillet', top.some(c => c.r >= rMin - 1e-9) && bottom.some(c => c.r >= rMin - 1e-9), fillets.map(c => [c.r, c.c[2]]), `root fillets top and bottom ≥ ${rMin} mm (0.25 h)`),
      holds('stress', sigma !== null && sigma <= m.yieldMPa / 2, sigma, `σ = F L c / I ≤ σy / 2 = ${m.yieldMPa / 2} MPa`),
      holds('deflection', delta !== null && delta <= num(p, 'dmax'), delta, `δ = F L³ / (3 E I) ≤ ${p.dmax} mm`),
    ] as Outcome[];
  },
  mutants: [
    { id: 'thin', target: 'stress', why: 'the arm 0.6 of the depth its stress needs', calls: p => bracket(p, { h: Math.max(1, Math.round(2 * 0.6 * depthFor(p, 'stress')) / 2) }) },
    { id: 'long', target: 'deflection', why: 'the arm twice as long', calls: p => bracket(p, { L: 2 * num(p, 'L') }) },
    { id: 'stepped', target: 'prismatic', why: 'its far half 0.8 deep', calls: p => bracket(p, { step: true }) },
    { id: 'stubby', target: 'slender', why: 'L/h = 3', calls: p => bracket(p, { h: num(p, 'L') / 3 }) },
    { id: 'no-fillet', target: 'fillet', why: 'no root fillet', calls: p => bracket(p, { fillet: false }) },
    { id: 'wrong-metal', target: 'material', why: 'the other metal stated', calls: p => bracket(p, { m: p.m === 'steel' ? 'al6061' : 'steel' }) },
    { id: 'two', target: 'body', why: 'the arm not joined to the plate', calls: p => bracket(p).filter(c => c.tool !== 'run_command' || (c.args as { command: string }).command !== 'union').filter(c => (c.args as { command?: string }).command !== 'fillet') },
  ],
};
