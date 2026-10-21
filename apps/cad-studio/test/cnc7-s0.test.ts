import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { holesOf, concaveSpan, extent } from '@barocss/cad-model/machining/holes';
import { narrowest } from '@barocss/cad-model/machining/cavities';
import { buildBvh, rayHit } from '@barocss/cad-model/print/orient';

// CNC7 S0 (O100): what feature recognition and stock can read exactly today, on a constructed plate with one of each
// feature — a closed pocket, a through slot, an edge step, a through hole, a blind hole and a boss — every oracle the
// construction. The probes classify floors by how their walls bound them (all round: a pocket; across only: a slot;
// one side: a step), find a boss (a convex exact cylinder rising from a plane that faces along its axis), and choose
// the smallest stock from a user's list around the part with an allowance flagged an estimate.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
// (A 120 × 80 × 20 plate: a pocket 30 × 20, 8 deep; a slot 10 wide, 6 deep, through along Y; a step 15 wide, 5 deep along
// the far edge; a through hole Ø6.6; a blind hole Ø5 × 10; a boss Ø12, 8 high on the top.)
const PLATE: [string, Record<string, unknown>][] = [
  cmd('box', { w: 120, d: 80, h: 20, x: 0, y: 0, z: 0 }),
  cmd('box', { w: 30, d: 20, h: 20, x: 10, y: 10, z: 12 }), ['run_command', { command: 'difference', values: {}, bodies: ['b1', 'b3'] }],
  cmd('box', { w: 10, d: 100, h: 20, x: 60, y: -10, z: 14 }), ['run_command', { command: 'difference', values: {}, bodies: ['b4', 'b6'] }],
  cmd('box', { w: 140, d: 15, h: 20, x: -10, y: 65, z: 15 }), ['run_command', { command: 'difference', values: {}, bodies: ['b7', 'b9'] }],
  cmd('hole', { d: 6.6, x: 90, y: 20 }, { faces: ['n1.top'] }),
  cmd('hole', { type: 'blind', d: 5, depth: 10, x: 100, y: 40 }, { faces: ['n1.top'] }),
  cmd('cylinder', { r: 6, h: 8, x: 30, y: 50, z: 20 }), ['run_command', { command: 'union', values: {}, bodies: ['b12', 'b14'] }],
];
type V = readonly number[];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A probe: each plane looking out with walls rising from it, classed by the directions its walls bound it on both sides. */
function floorsOf(b: BodyResult): { face: string; depth: number; width: number | null; kind: 'pocket' | 'slot' | 'step' }[] {
  const m = b.mesh, bvh = buildBvh(m), verts: number[][][] = m.faces.map(() => []);
  for (let i = 0; i < m.faceOfVertex.length; i++) verts[m.faceOfVertex[i]].push([m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]]);
  const nb = new Map<number, Set<number>>();
  for (const e of m.edges) for (const [x, y] of [[e.faces[0], e.faces[1]], [e.faces[1], e.faces[0]]]) { const s = nb.get(x) ?? new Set(); s.add(y); nb.set(x, s); }
  const out: ReturnType<typeof floorsOf> = [];
  for (const f of m.faces) {
    // (Per setup: the floors a tool along +Z faces — CNC4's first setup for the plate.)
    if (f.exact?.kind !== 'plane' || dot(f.exact.n, [0, 0, 1]) < 1 - 1e-9) continue;
    const n = f.exact.n, level = dot(f.exact.o, n), dirs: V[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].filter(u => Math.abs(dot(u, n)) < 1e-9);
    const side = (g: number) => dirs.some(u => { const s = verts[f.index].map(v => dot(v, u)), lo = Math.min(...s), hi = Math.max(...s); return verts[g].every(v => dot(v, u) >= hi - 1e-6) || verts[g].every(v => dot(v, u) <= lo + 1e-6); });
    // (A wall rising beside it, at its edge: a boss standing inside a face does not make it a floor.)
    const rising = [...(nb.get(f.index) ?? [])].filter(g => verts[g].some(v => dot(v, n) > level + 1e-6) && verts[g].every(v => dot(v, n) >= level - 1e-6) && side(g));
    if (!rising.length) continue;
    const c = verts[f.index].reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]).map(x => x / verts[f.index].length);
    if (rayHit(bvh, [c[0] + 0.01 * n[0], c[1] + 0.01 * n[1], c[2] + 0.01 * n[2]], n) !== Infinity) continue;
    const depth = Math.max(...rising.flatMap(g => verts[g].map(v => dot(v, n)))) - level;
    // (Bounded across u when a rising wall lies wholly at or past each side of the floor along u.)
    const bounded = dirs.filter(u => { const s = verts[f.index].map(v => dot(v, u)), lo = Math.min(...s), hi = Math.max(...s); return rising.some(g => verts[g].every(v => dot(v, u) >= hi - 1e-6)) && rising.some(g => verts[g].every(v => dot(v, u) <= lo + 1e-6)); });
    const kind = bounded.length === dirs.length ? 'pocket' : bounded.length ? 'slot' : 'step';
    out.push({ face: f.name, depth, width: kind === 'step' ? null : narrowest(verts[f.index], n, u => bounded.some(w => Math.abs(Math.abs(dot(u, w)) - 1) < 1e-9)), kind });
  }
  return out;
}
/** A probe: convex exact cylinders rising from a plane facing along their axis — bosses, their diameter and height. */
function bossesOf(b: BodyResult): { face: string; diameter: number; height: number }[] {
  const m = b.mesh, out: ReturnType<typeof bossesOf> = [];
  for (const f of m.faces) {
    const e = f.exact; if (e?.kind !== 'cylinder') continue;
    const l = Math.hypot(e.a[0], e.a[1], e.a[2]), a = [e.a[0] / l, e.a[1] / l, e.a[2] / l];
    if (concaveSpan(m, f.index, e.c, a) !== null) continue;
    const [lo, hi] = extent(m, f.index, e.c, a);
    // (Its base on a plane facing along +a or −a wider than it: the face it stands on.)
    for (const s of [1, -1]) {
      const base = s > 0 ? lo : hi, at = dot(e.c, a) + base, rises = s > 0 ? hi - lo : hi - lo;
      const plane = m.faces.find(g => g.exact?.kind === 'plane' && Math.abs(dot(g.exact.n, a) - s) < 1e-9 && Math.abs(dot(g.exact.o, a) - at) < 1e-6);
      if (plane) { out.push({ face: f.name, diameter: 2 * e.r, height: rises }); break; }
    }
  }
  return out;
}

test('CNC7 S0 P1: floors classed by their walls — the pocket 30 × 20 bounded all round (8 deep, 20 wide), the slot bounded across only (6 deep, 10 wide), the step one side (5 deep; its floor in two, the slot through it)', async () => {
  const s = await build(PLATE), fl = floorsOf(s.bodies[0]).map(f => [f.kind, +f.depth.toFixed(9), f.width === null ? null : +f.width.toFixed(9)]).sort();
  // (The slot runs through the step: the step's floor is two faces, either side of it — one feature, two floors.)
  assert.deepEqual(fl, [['pocket', 8, 20], ['slot', 6, 10], ['step', 5, null], ['step', 5, null]].sort(), JSON.stringify(fl));
});

test('CNC7 S0 P2: holes from CNC2 as features — Ø6.6 through 20, Ø5 blind 10 deep; the boss a convex cylinder rising from the top — Ø12, 8 high', async () => {
  const s = await build(PLATE), hs = holesOf(s.bodies).map(h => [+h.steps[0].diameterMM.toFixed(9), +(h.steps[0].toMM - h.steps[0].fromMM).toFixed(9), h.open[0] && h.open[1] ? 'through' : 'blind']).sort();
  assert.deepEqual(hs, [[5, 10, 'blind'], [6.6, 20, 'through']]);
  assert.deepEqual(bossesOf(s.bodies[0]).map(b => [+b.diameter.toFixed(9), +b.height.toFixed(9)]), [[12, 8]]);
});

test('CNC7 S0 P3: stock from the user\'s list — the smallest block whose sorted sides hold the part\'s plus twice an allowance (1 mm, an estimate); a bar for a turned part; none fits — said', () => {
  // (The part's box, sorted: 120 × 80 × 28 with the boss. A 2 mm allowance per side (1 each face) — flagged an estimate.)
  const part = [120, 80, 28], allowance = 1, need = part.map(x => x + 2 * allowance);
  const list = [[150, 100, 25], [125, 85, 32], [200, 100, 40], [122, 82, 30]];
  const fit = list.map(b => [...b].sort((x, y) => y - x)).filter(b => b.every((x, k) => x >= need[k] - 1e-9)).sort((a, b) => a[0] * a[1] * a[2] - b[0] * b[1] * b[2]);
  assert.deepEqual(fit[0], [122, 82, 30], 'the smallest that holds 122 × 82 × 30');
  // (A bar: Ø20 × 52 turned, its diameters on the list — the smallest ≥ 22, cut to 54.)
  const bars = [16, 20, 22, 25, 30], d = bars.filter(x => x >= 20 + 2 * allowance - 1e-9).sort((a, b) => a - b)[0];
  assert.deepEqual([d, 52 + 2 * allowance], [22, 54]);
  assert.equal([[100, 50, 20]].filter(b => b.every((x, k) => x >= need[k])).length, 0, 'none fits: STOCK_NONE_FITS, said');
});
