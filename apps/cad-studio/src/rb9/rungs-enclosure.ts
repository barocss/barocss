// RB9 rungs 8 and 9 (O70): enclosures with the library's parts — a PCB enclosure on standoffs under a board, with a
// cable hole and vents; a snap-fit box (below). The checker reads the part: the standoffs' exact cylinders on the
// board's hole pattern, the board's component space as a keep-out checked by the studio's own keep-out check, the vents
// by the kernel's section through their wall, the wall by the FDM profile's minimum.
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { processProfile } from '@barocss/cad-model/library/materials';
import type { Call, Evaluate, Outcome, Params, Rung } from './core';
import { axisDistance, boxIs, cylindersOf, distinctCylinders, holds, parallel, planeFace, studioChecks } from './measure';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { ModelNode } from '@barocss/cad-model/engine/doc';
import { meshDistance } from '@barocss/cad-model/robot/sweep';
type LibraryNode = Extract<ModelNode, { kind: 'library' }>;

const num = (p: Params, k: string) => p[k] as number;
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): Call => ({ tool: 'run_command', args: { command, values, ...sel } });
const lib = (part: string, face: string, point: number[], extra: Record<string, unknown> = {}): Call => ({ tool: 'add_library_part', args: { library: 'enclosure', part, face, point, ...extra } });
/** The library standoff's outside diameter by its variant: 2d + 1.2 (enclosure.json). */
const OD: Record<string, number> = { 'M2.5': 2 * 2.5 + 1.2, M3: 2 * 3 + 1.2 };
const SW = 1.5, PITCH = 3.5, BOARD = 1.6;
/** A studio tool on a copy of the part (the checker's, never the agent's): its JSON answer. */
async function onCopy(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, steps: [string, Record<string, unknown>][]): Promise<unknown> {
  let s: ChatState = { doc, bodies: [...bodies] }, last: unknown = null;
  for (const [tool, args] of steps) { const r = await dispatchTool(s, tool, args, evaluate as never); if (r.isError) return { error: r.content }; s = r.state; last = JSON.parse(r.content); }
  return last;
}

// ——— 9. the PCB enclosure
const holesOf = (p: Params): [number, number][] => {
  const w = num(p, 'w'), d = num(p, 'd'), a = num(p, 'a'), b = num(p, 'b'), i = num(p, 'i'), ox = (w - a) / 2, oy = (d - b) / 2;
  return [[ox + i, oy + i], [ox + a - i, oy + i], [ox + a - i, oy + b - i], [ox + i, oy + b - i]];
};
const pcb = (p: Params, o: { moved?: boolean; hs?: number; cable?: boolean; vent?: boolean; t?: number; loose?: boolean; w?: number } = {}): Call[] => {
  const w = o.w ?? num(p, 'w'), d = num(p, 'd'), h = num(p, 'h'), t = o.t ?? num(p, 't');
  const c: Call[] = [cmd('box', { w, d, h, x: 0, y: 0, z: 0 }), cmd('shell', { t }, { faces: ['n1.top'] })];
  holesOf(p).forEach(([x, y], k) => c.push(lib('pcb-standoff', 'n2.floor', [k === 0 && o.moved ? x + 1 : x, y, t], { variant: p.v, params: { h: o.hs ?? num(p, 'hs') } })));
  if (o.cable !== false) c.push(cmd('hole', { type: 'blind', d: 8, depth: t, x: w / 2, y: 12 }, { faces: [{ normal: [0, -1, 0], pick: 'max' }] }));
  if (o.vent !== false) c.push(lib('slot-vent', 'n1.side1', [w, d / 2, h / 2], { params: { n: num(p, 'n'), sl: num(p, 'sl'), sw: SW, p: PITCH } }));
  if (o.loose) c.push(cmd('box', { w: 5, d: 5, h: 5, x: w + 20, y: 0, z: 0 }));
  return c;
};
export const RUNG9: Rung = {
  n: 9, id: 'pcb-enclosure', title: 'PCB enclosure',
  space: [{ key: 'w', lo: 90, hi: 140, step: 1 }, { key: 'd', lo: 60, hi: 100, step: 1 }, { key: 'h', lo: 25, hi: 40, step: 1 }, { key: 't', lo: 2, hi: 3, step: 0.5 },
    { key: 'a', lo: 40, hi: p => num(p, 'w') - 2 * num(p, 't') - 30, step: 1 }, { key: 'b', lo: 30, hi: p => num(p, 'd') - 2 * num(p, 't') - 30, step: 1 }, { key: 'i', lo: 3.5, hi: 5, step: 0.5 },
    { key: 'v', choice: ['M2.5', 'M3'] }, { key: 'hs', lo: 5, hi: 10, step: 0.5 }, { key: 'c', lo: 3, hi: p => num(p, 'h') - num(p, 't') - num(p, 'hs') - BOARD - 2, step: 0.5 },
    { key: 'n', lo: 3, hi: 8, step: 1 }, { key: 'sl', lo: 8, hi: p => Math.min(15, num(p, 'h') - 2 * num(p, 't') - 4), step: 1 }],
  prompt: p => `An FDM-printed PCB enclosure: an open-top box ${p.w} × ${p.d} × ${p.h} mm outside with ${p.t} mm walls and floor. A ${p.a} × ${p.b} mm board sits centred over the floor on four ${p.v} standoffs ${p.hs} mm tall, under its holes ${p.i} mm in from its corners; keep ${p.c} mm above the board clear for its components (1 mm clearance). A Ø8 mm cable hole through the front wall, 12 mm up in its middle; a vent of ${p.n} slots ${p.sl} × ${SW} mm (pitch ${PITCH}) in the middle of the right wall.`,
  scripted: p => pcb(p),
  async check({ doc, bodies }, p, evaluate) {
    const w = num(p, 'w'), d = num(p, 'd'), h = num(p, 'h'), t = num(p, 't'), hs = num(p, 'hs'), r = OD[p.v as string] / 2, cyl = distinctCylinders(cylindersOf(bodies)), fdm = processProfile('fdm')!.thresholds;
    const standoffs = holesOf(p).map(([x, y]) => cyl.find(c => Math.abs(c.r - r) <= 1e-9 && parallel(c.a, [0, 0, 1]) && axisDistance(c, [x, y, 0]) <= 1e-9 && Math.abs(c.zMax - c.zMin - hs) <= 1e-4));
    const cable = cyl.find(c => Math.abs(c.r - 4) <= 1e-9 && parallel(c.a, [0, 1, 0]) && axisDistance(c, [w / 2, 0, 12]) <= 1e-9 && Math.abs(c.zMax - c.zMin - t) <= 1e-4);
    // (The board's component space, from its top: a keep-out the studio's own check measures, 1 mm clearance asked.)
    const [ox, oy] = [(w - num(p, 'a')) / 2, (d - num(p, 'b')) / 2];
    const ko = await onCopy(doc, bodies, evaluate, [['add_keepout', { name: 'components', box: { frame: { origin: [ox, oy, t + hs + BOARD], normal: [0, 0, 1], xAxis: [1, 0, 0] }, size: [num(p, 'a'), num(p, 'b'), num(p, 'c')] }, clearance: 1 }], ['check_keepouts', {}]]) as { results?: { verdict: string; clearance_mm?: number }[] };
    // (The vents: the right wall cut at mid-thickness loses n slots — between their obround and rectangular areas.)
    const sec = await onCopy(doc, bodies, evaluate, [['section', { axis: 'x', at: w - t / 2 }]]) as { cut?: { body: string; cut_area_mm2: number }[] };
    const area = sec.cut ? sec.cut.reduce((s, x) => s + x.cut_area_mm2, 0) : null, n = num(p, 'n'), sl = num(p, 'sl'), lost = area === null ? null : d * h - area;
    const wall = await studioChecks(doc, evaluate, [{ id: 'min-wall', source: `FDM walls ≥ ${fdm.minWall.value} mm`, hard: true, check: { op: '>=', query: { fn: 'min_wall' }, value: fdm.minWall.value } } as never], { process: 'fdm' });
    const out: Outcome[] = [boxIs('box', bodies, [w, d, h]), holds('solids', bodies.length === 1, bodies.length, 'one solid'),
      holds('standoffs', standoffs.every(Boolean), standoffs.map(Boolean), `four Ø${2 * r} standoffs ${hs} tall on the board's holes`),
      holds('components', !!ko.results?.length && ko.results.every(x => x.verdict === 'clear'), ko.results?.map(x => [x.verdict, x.clearance_mm]) ?? ko, 'the board\'s component space clear by 1 mm'),
      holds('cable', !!cable, null, 'a Ø8 hole through the front wall at its middle, 12 up'),
      holds('vents', lost !== null && lost >= n * (SW * (sl - SW) + Math.PI * SW * SW / 4) - 1e-3 && lost <= n * sl * SW + 1e-3, lost, `${n} slots through the right wall (${(n * (SW * (sl - SW) + Math.PI * SW * SW / 4)).toFixed(2)} … ${(n * sl * SW).toFixed(2)} mm² cut)`), ...wall];
    return out;
  },
  mutants: [
    { id: 'moved', target: 'standoffs', why: 'a standoff 1 mm off its hole', calls: p => pcb(p, { moved: true }) },
    { id: 'tall', target: 'components', why: 'the standoffs 3 mm taller, into the components', calls: p => pcb(p, { hs: num(p, 'hs') + 3 }) },
    { id: 'no-cable', target: 'cable', why: 'no cable hole', calls: p => pcb(p, { cable: false }) },
    { id: 'no-vent', target: 'vents', why: 'no vent', calls: p => pcb(p, { vent: false }) },
    { id: 'thin', target: 'min-wall', why: 'walls 0.6', calls: p => pcb(p, { t: 0.6 }) },
    { id: 'loose', target: 'solids', why: 'a loose piece beside it', calls: p => pcb(p, { loose: true }) },
    { id: 'wide', target: 'box', why: '5 mm too wide', calls: p => pcb(p, { w: num(p, 'w') + 5 }) },
  ],
};

// ——— 8. the snap-fit box
// (The hooks' material is the brief's, stated by the user — the product path a real agent takes: no context numbers.)
// (G: the FDM profile's fit gap — the clearance round every hook, tip to wall, catch to ledge.)
const G = processProfile('fdm')!.thresholds.fitGap.value, HH = 2;
/** One library part's triangles in a body (its faces by their prefix): the hook alone, for its clearance from the box. */
function partMesh(bodies: readonly BodyResult[], prefix: string): { p: Float32Array; i: Uint32Array } | null {
  for (const b of bodies) {
    const m = b.mesh, faces = new Set(m.faces.filter(f => f.name.startsWith(`${prefix}_`)).map(f => f.index));
    if (!faces.size) continue;
    const idx: number[] = [];
    for (let t = 0; t < m.indices.length; t += 3) if (faces.has(m.faceOfVertex[m.indices[t]])) idx.push(m.indices[t], m.indices[t + 1], m.indices[t + 2]);
    return { p: m.positions, i: Uint32Array.from(idx) };
  }
  return null;
}
const hookYs = (p: Params): number[] => { const D = num(p, 'D'); return num(p, 'nh') === 2 ? [D / 2] : [D / 4, 3 * D / 4]; };
const snapBox = (p: Params, o: { material?: boolean; hooks?: number; ledges?: number; e?: number; drop?: number; out?: number; shift?: number; loose?: boolean } = {}): Call[] => {
  const W = num(p, 'W'), D = num(p, 'D'), H = num(p, 'H'), s = num(p, 's'), tl = num(p, 'tl'), tb = num(p, 'tb'), y = num(p, 'y'), L = num(p, 'L'), b = num(p, 'b'), m = p.m as string, said = `printed in ${m.toUpperCase()}`;
  const c: Call[] = [{ tool: 'set_brief', args: { fields: { purpose: { value: 'a box that snaps shut', basis: 'stated', source: 'snaps shut' }, process: { value: 'fdm', basis: 'stated', source: said },
    ...(o.material === false ? {} : { material: { value: m, basis: 'stated', source: said } }) } } },
  cmd('box', { w: W, d: D, h: H, x: 0, y: 0, z: 0 }), cmd('shell', { t: s }, { faces: ['n1.top'] }), cmd('box', { w: W, d: D, h: tl, x: 0, y: 0, z: H })];
  // (Each hook's latch faces its wall: its beam e + g in from the ledge's face, the tip g short of the wall.)
  let j = 0;
  for (const side of [1, -1]) for (const yc of hookYs(p)) {
    if (j++ >= (o.hooks ?? 99)) continue;
    const wall = side > 0 ? W - s : s, px = wall - side * (y + G + tb / 2 - (o.out ?? 0));
    c.push(lib('snap-hook', 'n4.bottom', [px, yc, H], { x_direction: [0, -side, 0], params: { L, t: tb, b, y } }));
  }
  let k = 0;
  for (const side of [1, -1]) for (const yc of hookYs(p)) if (k++ < (o.ledges ?? 99)) c.push(lib('snap-ledge', side > 0 ? 'n2.in.n1.side1' : 'n2.in.n1.side3', [side > 0 ? W - s : s, yc + (o.shift ?? 0), H - L + G + 0.75 - (o.drop ?? 0)], { x_direction: [0, side, 0], params: { e: o.e ?? y, b } }));
  if (o.loose) c.push(cmd('box', { w: 5, d: 5, h: 5, x: W + 20, y: 0, z: 0 }));
  return c;
};
export const RUNG8: Rung = {
  n: 8, id: 'snap-fit-box', title: 'snap-fit box',
  space: [{ key: 'W', lo: 60, hi: 120, step: 1 }, { key: 'D', lo: 40, hi: 80, step: 1 }, { key: 'H', lo: 25, hi: 40, step: 1 }, { key: 's', lo: 1.5, hi: 3, step: 0.5 }, { key: 'tl', lo: 2, hi: 3, step: 0.5 },
    { key: 'm', choice: ['abs', 'petg'] }, { key: 'nh', choice: [2, 4] as never }, { key: 'tb', lo: 1.2, hi: 2, step: 0.1 }, { key: 'y', lo: 0.6, hi: 1.2, step: 0.1 }, { key: 'b', lo: 5, hi: 10, step: 1 },
    // (Long enough that the root strain stays under ABS's yield, 1.5 t y / L² ≤ 0.016 — its σy/E is 0.018.)
    { key: 'L', lo: p => Math.ceil(Math.sqrt(1.5 * num(p, 'tb') * num(p, 'y') / 0.016)), hi: p => num(p, 'H') - num(p, 's') - HH - 4, step: 1 }],
  prompt: p => `A box that snaps shut, printed in ${(p.m as string).toUpperCase()}: ${p.W} × ${p.D} × ${p.H} mm outside, open on top, ${p.s} mm walls and floor, and a flat lid ${p.W} × ${p.D} × ${p.tl} mm resting on its rim. ${p.nh} cantilever snap hooks hang from the lid's underside, half by the left wall and half by the right, ${p.nh === 2 ? 'in the middle of each' : 'at a quarter and three quarters along each'}: ${p.b} mm wide, ${p.tb} mm thick, ${p.L} mm long, each with a ${p.y} mm undercut facing its wall. Each latches under a ledge on the inside of its wall, ${p.y} mm deep, with ${G} mm clear between the hook's tip and the wall and between its catch and the ledge.`,
  scripted: p => snapBox(p),
  async check({ doc, bodies }, p, evaluate) {
    const W = num(p, 'W'), D = num(p, 'D'), H = num(p, 'H'), tl = num(p, 'tl'), y = num(p, 'y'), b = num(p, 'b');
    const libs = doc.nodes.flatMap((n, i) => n.kind === 'library' ? [{ n: n as LibraryNode, id: n.id ?? `n${i}` }] : []);
    const hooks = libs.filter(x => x.n.library.part === 'snap-hook'), ledges = libs.filter(x => x.n.library.part === 'snap-ledge').map(x => planeFace(bodies, `${x.n.prefix}_k.top`));
    // (Latched: each hook's catch faces a ledge's underside across 0 … 2G, and the two overlap by the undercut less G, the hook's width wide.)
    const latch = hooks.map(h => {
      const f = planeFace(bodies, `${h.n.prefix}_h.side2`); if (!f) return null;
      return Math.max(0, ...ledges.map(l => {
        if (!l || l.n[0] * f.n[0] + l.n[1] * f.n[1] + l.n[2] * f.n[2] > -1 + 1e-9) return 0;
        const gap = (l.o[0] - f.o[0]) * f.n[0] + (l.o[1] - f.o[1]) * f.n[1] + (l.o[2] - f.o[2]) * f.n[2]; if (gap < -1e-6 || gap > 2 * G + 1e-6) return 0;
        const ov = [0, 1, 2].map(k => Math.abs(f.n[k]) > 0.5 ? 1 : Math.max(0, Math.min(f.max[k], l.max[k]) - Math.max(f.min[k], l.min[k])));
        return ov[0] * ov[1] * ov[2];
      }));
    });
    const need = (y - G) * b - 1e-3;
    const fit = await onCopy(doc, bodies, evaluate, [['interference', {}]]) as { pairs?: { overlap_mm3?: number }[] };
    // (Each hook clear of the box by the fit gap: its own triangles against the body they do not belong to.)
    const gaps = hooks.map(h => { const pm = partMesh(bodies, h.n.prefix), other = bodies.find(x => !x.mesh.faces.some(f => f.name.startsWith(`${h.n.prefix}_`))); return pm && other ? meshDistance(pm.p, pm.i, other.mesh.positions, other.mesh.indices) : null; });
    const flex = await studioChecks(doc, evaluate, hooks.flatMap(h => ['strain', 'yield'].map(check => ({ id: `${h.id}.${check}`, source: `${h.id} ${check}`, hard: true, check: { op: '<=', query: { fn: 'library_check', feature: h.id, check }, value: 1 } } as never))));
    return [boxIs('box', bodies, [W, D, H + tl]), holds('solids', bodies.length === 2, bodies.length, 'two solids: the box and its lid'),
      holds('hooks', hooks.length === 2 * hookYs(p).length, hooks.length, `${2 * hookYs(p).length} snap hooks`),
      holds('flex', flex.length > 0 && flex.every(x => x.pass), flex.map(x => [x.id, x.measured]), 'each hook\'s root strain within the material\'s allowable strain and yield (the brief\'s material)'),
      holds('latched', latch.length > 0 && latch.every(a => a !== null && a >= need), latch, `each hook's catch under a ledge, ≥ ${need.toFixed(3)} mm² overlapping within ${2 * G} mm`),
      holds('clearance', gaps.length > 0 && gaps.every(g => g !== null && g >= G - 1e-4), gaps.map(g => g === null ? null : +g.toFixed(5)), `each hook ≥ ${G} mm (the FDM fit gap) from the box`),
      holds('fits', !!fit.pairs && fit.pairs.every(x => x.overlap_mm3 === undefined), fit.pairs ?? fit, 'the lid and the box do not overlap')];
  },
  mutants: [
    { id: 'no-material', target: 'flex', why: 'the brief without the stated material: the hooks\' strain unknown', calls: p => snapBox(p, { material: false }) },
    { id: 'hook-short', target: 'hooks', why: 'one hook fewer than asked', calls: p => snapBox(p, { hooks: 2 * hookYs(p).length - 1 }) },
    { id: 'no-ledge', target: 'latched', why: 'one hook with no ledge', calls: p => snapBox(p, { ledges: 2 * hookYs(p).length - 1 }) },
    { id: 'ledge-moved', target: 'latched', why: 'the ledges 2 mm along their walls', calls: p => snapBox(p, { shift: 2 }) },
    { id: 'tight', target: 'clearance', why: 'the ledges down on the catches: no fit gap', calls: p => snapBox(p, { drop: G }) },
    { id: 'shallow', target: 'latched', why: 'ledges 0.15 deep: the catch misses them', calls: p => snapBox(p, { e: 0.15 }) },
    { id: 'low', target: 'fits', why: 'ledges 0.6 lower, through the catches', calls: p => snapBox(p, { drop: 0.6 }) },
    { id: 'into-wall', target: 'fits', why: 'hooks 1 mm outward, into their walls', calls: p => snapBox(p, { out: 1 }) },
    { id: 'loose', target: 'solids', why: 'a loose piece beside it', calls: p => snapBox(p, { loose: true }) },
    { id: 'wide', target: 'box', why: 'the box and lid 5 mm wider than asked', calls: p => snapBox({ ...p, W: num(p, 'W') + 5 }) },
  ],
};
