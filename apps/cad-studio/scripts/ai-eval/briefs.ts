// The AI evaluation's brief ladder (2026-10-24): what a person would type, graded from one part to a product, each with
// an oracle the agent never sees. Ten rungs are RB9's (packages/barocss-cad-model/src/rb9: their prompts and their
// hidden checkers, which RB9's mutants have shown to catch what they target), at one fixed parameter sample; the rest
// are this ladder's own, for what RB9 does not reach: standard sizes from the person's files (the shipped sample rows,
// rule (b)), gears, a SCARA, a saved motion, drawings, CAM, casting, STEP/3MF and the A9 product. Closed forms are
// written out beside each check; dimensions are the brief's, not a standard's.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { flattenAssembly } from '@barocss/cad-model/engine/flatten';
import { RUNGS } from '@barocss/cad-model/rb9/rungs';
import { sample, type Rung } from '@barocss/cad-model/rb9/core';
import { clearanceMap, applyFill, fillOverlap } from '@barocss/cad-model/team/clearanceMap';
import type { CallRecord } from './codex';
import { LONG_BRIEFS } from './long';
import { type Element, allNodes, check, evaluates, hasKind, oneSolid, reads, size, sizeOf, solids, sorted, volume, volumeOf, type Check, type Judged } from './oracle';

// (The bundle runs from a temporary folder: ai-eval.mjs passes the repository's path.)
export const REPO = process.env.AI_EVAL_REPO ?? resolve(import.meta.dirname, '../../../..');
const MODEL = join(REPO, 'packages/barocss-cad-model');
const SAMPLE_ROWS = join(MODEL, 'samples/rows'), A9_ROWS = join(MODEL, 'conformance/a9/rows'), ROBOTS = join(MODEL, 'samples/robots');

export type Ladder = 'single part' | 'standard sizes' | 'assembly' | 'mechanism' | 'outputs' | 'product' | 'long prompt';
export interface Brief {
  id: string; ladder: Ladder; title: string; prompt: string;
  /** A document the person opened first (a .bcad path); else an empty part. */
  start?: string;
  /** Files the person attached in the conversation (paths). */
  files?: string[];
  /** Where RB9's rung comes from, when it is one. */
  rb9?: string;
  oracle(j: Judged, calls: CallRecord[]): Promise<Check[]>;
  /** A long descriptive brief's elements, each scored done / approximated / missing / refused (oracle.ts). */
  elements?: Element[];
  /** This brief's own run caps, where the defaults are too small for it. */
  caps?: { maxCalls?: number; maxTurns?: number; wallMin?: number };
  /** A known build through the same tools (`validate`): the oracle must pass it. */
  reference?: { tool: string; args: Record<string, unknown> }[];
}

const PI = Math.PI, DEG = PI / 180;
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
/** Every material named: under a key `material` (body looks — doc.bodies —, placed parts'), and each brief's material value; lower case. */
function materials(doc: StudioDoc): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key = '') => {
    if (typeof v === 'string' && key === 'material') out.push(v.toLowerCase());
    else if (Array.isArray(v)) v.forEach(x => walk(x));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk({ bodies: doc.bodies, instances: doc.instances?.map(i => ({ bodies: i.doc.bodies, brief: i.doc.brief })), brief: doc.brief });
  // (The brief's material is the base part's, the system prompt says; a placed part's brief its own.)
  for (const b of [doc.brief, ...(doc.instances ?? []).map(i => i.doc.brief)]) { const v = (b as { material?: { value?: unknown } } | undefined)?.material?.value; if (typeof v === 'string') out.push(v.toLowerCase()); }
  return out;
}
const hasMaterial = (id: string, doc: StudioDoc, re: RegExp, what: string, hard = true) => { const m = materials(doc); return check(id, what, m.some(x => re.test(x)), [...new Set(m)], String(re), hard); };
/** The process the brief or the document names. */
const processOf = (doc: StudioDoc) => [doc.process, (doc.brief as { process?: { value?: string } } | undefined)?.process?.value].filter(Boolean).map(String);
const hasProcess = (id: string, doc: StudioDoc, re: RegExp, what: string, hard = true) => check(id, what, processOf(doc).some(p => re.test(p)), processOf(doc), String(re), hard);
/** Rows loaded from the person's file, by its file name (each loaded row keeps the file's receipt). */
const rowsFrom = (id: string, doc: StudioDoc, file: string, hard = true) => { const s = JSON.stringify(doc); return check(id, `rows loaded from the person's ${file} (receipt kept)`, s.includes(`"${file}"`) && /"suppliedBy":"person"/.test(s), s.includes(`"${file}"`) ? 'receipt found' : 'no receipt', file, hard); };
/** A successful call of a tool action. */
const called = (calls: CallRecord[], tool: string, action?: string) => calls.filter(c => c.ok && c.tool === tool && (!action || (c.args as { action?: string } | undefined)?.action === action));
const didCall = (id: string, calls: CallRecord[], tool: string, action: string, what: string, hard = true) => { const n = called(calls, tool, action).length; return check(id, what, n > 0, n, '≥ 1 successful call', hard); };
/** Non-fixed joints of the assembly as the engine reads it (assembly.joints). */
async function joints(j: Judged): Promise<{ key: string; type: string; child: string; axis: number[]; origin: number[]; limit?: { lower?: number; upper?: number; effort?: number; velocity?: number } }[] | null> {
  const r = await j.read('assembly', { action: 'joints' });
  return r.error ? null : (r.joints ?? []).filter((x: { type: string }) => x.type !== 'fixed');
}
/** A part's largest solid alone (its made body beside bought ones), as a list. */
const biggest = (b: BodyResult[] | null) => { const s = solids(b).sort((x, y) => (y.volume ?? 0) - (x.volume ?? 0)); return s.length ? [s[0]] : null; };
const vertical = (a: number[]) => Math.abs(a[2]) > 0.999;
const near = (a: number | undefined, b: number, tol: number) => typeof a === 'number' && Math.abs(a - b) <= tol;
/** The horizontal distance between two vertical axes through their points. */
const axisGap = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** A placed part that is a fastener (the fastener command's instance). */
const fastenerPart = (doc: StudioDoc, key: string) => { const id = key.split('/')[0], inst = (doc.instances ?? []).find(i => i.id === id); return !!inst && inst.doc.nodes.some(n => /fastener|screw|bolt/i.test(JSON.stringify(n).slice(0, 200))); };
/**
 * The assembly's placed bodies with no overlap (every contact's overlap worked out). `screws`: a fastener part's overlap
 * is its thread's engagement, not counted — the clearance map does not yet call a screw in its tapped hole designed (a
 * gap this evaluation reports) — and listed apart.
 */
async function noOverlap(id: string, j: Judged, hard = true, screws = false): Promise<Check> {
  if (!j.placed.length) return check(id, 'no parts overlap', false, 'no placed bodies', undefined, hard);
  try {
    const map = clearanceMap(j.placed, { near: 0.5 });
    for (const p of [...map.pairs]) if (p.overlap && 'pending' in p.overlap) applyFill(map, fillOverlap(map, j.placed, p));
    const all = map.pairs.filter(p => p.state === 'overlap'), threads = screws ? all.filter(p => fastenerPart(j.doc, p.a) || fastenerPart(j.doc, p.b)) : [];
    const over = all.filter(p => !threads.includes(p)).map(p => `${p.a} × ${p.b}`);
    return check(id, `no parts overlap (designed seats aside${screws ? '; screws in their holes aside' : ''})`, over.length === 0, { overlaps: over.slice(0, 6), ...(threads.length ? { screwEngagements: threads.length } : {}) }, 'none', hard);
  } catch (e) { return check(id, 'no parts overlap', false, e instanceof Error ? e.message : String(e), undefined, hard); }
}
/** Placed bodies' world boxes. */
const boxes = (j: Judged) => j.placed.map(b => {
  const P = b.mesh.positions, m = b.pose.m, t = b.pose.t, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { const w = m[3 * k] * P[i] + m[3 * k + 1] * P[i + 1] + m[3 * k + 2] * P[i + 2] + t[k]; lo[k] = Math.min(lo[k], w); hi[k] = Math.max(hi[k], w); }
  return { key: b.key, lo, hi, size: hi.map((h, k) => h - lo[k]) };
});

// ——— RB9's rungs, at one sample each (seed 1, trial 5: an interior draw, not a range end)
/**
 * RB9.7 and RB9.12 count the parts as placed instances only (their scripted agent adds even the fixed part with
 * add_part), while the studio's system prompt tells the agent to build the main or fixed part as the base part. A
 * document whose base part has solids is shown to those checkers with its base part as a grounded instance of its own —
 * the same geometry, the same mates — so they judge the parts, not where the prompt said to put the first one.
 */
function baseAsInstance(doc: StudioDoc, solidsInBase: number): StudioDoc {
  if (!solidsInBase) return doc;
  const id = 'p0base', { instances, mates, robot: _robot, drawing: _drawing, proposals: _proposals, history: _history, ...part } = doc as StudioDoc & { history?: unknown };
  void _robot; void _drawing; void _proposals; void _history;
  const swap = (r: { part: string; face: string }) => r.part === 'base' ? { ...r, part: id } : r;
  return { ...doc, nodes: [], outputs: {}, bodies: undefined, instances: [{ id, name: 'Base', doc: { ...part, instances: [] } as StudioDoc, position: [0, 0, 0], rotation: [0, 0, 0], grounded: true }, ...(instances ?? [])], mates: (mates ?? []).map(m => ({ ...m, a: swap(m.a), b: swap(m.b) })) } as StudioDoc;
}
/**
 * RB9.11 reads one part's two bodies (a print-in-place toy is one print), while the system prompt tells the agent to
 * make a mechanism an assembly: a document with placed parts is shown to that checker flattened — each placed part's
 * features folded into the base part where they stand (engine/flatten.ts, as a sub-assembly inserted elsewhere is).
 */
function rb9(n: number, ladder: Ladder, o: { baseAsInstance?: boolean; flatten?: boolean } = {}): Brief {
  const rung = RUNGS.find(r => r.n === n) as Rung, p = sample(rung.space, 1, 5);
  return {
    id: `rb9-${rung.id}`, ladder, title: `RB9.${n} ${rung.title}`, prompt: rung.prompt(p), rb9: `RB9.${n} ${rung.id} ${JSON.stringify(p)}`,
    async oracle(j) {
      const shown = o.baseAsInstance ? baseAsInstance(j.doc, solids(j.base).length) : o.flatten && j.doc.instances?.length ? flattenAssembly(j.doc) : j.doc, e = await evaluatePart(shown, 1);
      const outcomes = await rung.check({ doc: shown, bodies: e.ok ? e.bodies : [] }, p, async d => evaluatePart(d, 1));
      return [...outcomes.map(x => check(x.id, `RB9: ${x.expected}`, x.pass, x.measured, x.expected, x.hard)),
        ...(shown !== j.doc ? [check('shown', o.flatten ? 'the placed parts shown to RB9 folded into one part (the system prompt makes a mechanism an assembly)' : 'the base part shown to RB9 as a grounded instance (the system prompt builds the fixed part there)', true, undefined, undefined, false)] : [])];
    },
  };
}

// ——— This ladder's own rungs
const FLANGED_SHAFT: Brief = {
  reference: [
    { tool: 'model', args: { source: 'const f = cylinder({r: 25, h: 8, x: 0, y: 0, z: 0})\nconst s = cylinder({r: 10, h: 72, x: 0, y: 0, z: 8})\nunion([f, s])\nhole(f.top, {d: 6.6, pat: "circle", pn: 6, qa: 0, qb: 0, x: 19, y: 0})\nchamfer([edge(s.top, s.side0)], {distance: 1})' } },
    { tool: 'features', args: { action: 'material', material: 'steel' } }],
  id: 'flanged-shaft', ladder: 'single part', title: 'flanged shaft (revolved, patterned, chamfered)',
  prompt: 'A steel flanged shaft, turned as one solid: a Ø50 mm flange 8 mm thick, and on it a Ø20 mm shaft 72 mm long on the same axis (80 mm overall). Six Ø6.6 mm through holes in the flange, evenly spaced on a Ø38 mm bolt circle. A 1 mm × 45° chamfer on the free end of the shaft.',
  async oracle(j) {
    // (π·25²·8 + π·10²·72 − 6·π·3.3²·8; the chamfer's ring, 2π·(10 − 1/3)·½ ≈ 30 mm³, is below the band: its own check.)
    const v = PI * 25 ** 2 * 8 + PI * 10 ** 2 * 72 - 6 * PI * 3.3 ** 2 * 8 - 2 * PI * (10 - 1 / 3) * 0.5;
    return [evaluates('builds', j.base), oneSolid('solids', j.base), size('size', j.base, [50, 50, 80]), volume('volume', j.base, v, 0.003, 'volume (flange, shaft, six holes)'),
      hasKind('chamfer', j.doc, 'chamfer', 'a chamfer feature'), hasMaterial('material', j.doc, /steel/, 'steel')];
  },
};
const TAPPED_PLATE: Brief = {
  reference: [
    { tool: 'features', args: { action: 'load_rows', kind: 'fastener-sizes', file: '$file:fastener-sizes.json' } },
    { tool: 'model', args: { source: 'const p = box({w: 80, d: 60, h: 10, x: 0, y: 0, z: 0})\nfor (const x of [8, 72]) { for (const y of [8, 52]) { hole(p.top, {type: "tapped", thread: "M5", tend: "through", x, y}) } }' } },
    { tool: 'features', args: { action: 'material', material: 'al6061' } }],
  id: 'tapped-plate', ladder: 'standard sizes', title: 'plate with M5 tapped holes (fastener sizes from the person\'s file)',
  prompt: 'An aluminium 6061 plate 80 × 60 × 10 mm with four M5 tapped through holes, their centres 8 mm in from both edges. Use the fastener sizes in the file I attached for the thread and tap drill.',
  files: [join(SAMPLE_ROWS, 'fastener-sizes.json')],
  async oracle(j) {
    const tap = (json(join(SAMPLE_ROWS, 'fastener-sizes.json')).rows as { id: string; tap: number }[]).find(r => r.id === 'M5')!.tap;
    const tapped = allNodes(j.doc).filter(n => n.kind === 'hole' && /^M5\b/.test(String(n.thread ?? ''))).length;
    return [rowsFrom('rows', j.doc, 'fastener-sizes.json'), evaluates('builds', j.base), oneSolid('solids', j.base), size('size', j.base, [80, 60, 10]),
      volume('volume', j.base, 80 * 60 * 10 - 4 * PI * (tap / 2) ** 2 * 10, 0.002, `volume (four Ø${tap} tap drills through, the row's)`),
      check('thread', 'holes recorded as M5 tapped (cosmetic thread)', tapped >= 1, tapped, '≥ 1 tapped M5 hole feature'), hasMaterial('material', j.doc, /6061/, 'aluminium 6061')];
  },
};
const MOTOR_PLATE: Brief = {
  reference: [
    { tool: 'features', args: { action: 'load_rows', kind: 'mounts', file: '$file:mounts.json' } },
    { tool: 'model', args: { source: 'const p = box({w: 80, d: 80, h: 6, x: 0, y: 0, z: 0})\nmount(p.top, {row: "nema17", x: 40, y: 40, pilot: "through"})\nfor (const x of [8, 72]) { for (const y of [8, 72]) { hole(p.top, {d: 5.5, x, y}) } }' } },
    { tool: 'features', args: { action: 'material', material: 'al6061' } }],
  id: 'motor-plate', ladder: 'standard sizes', title: 'NEMA 17 motor plate (mount rows from the person\'s file)',
  prompt: 'A 6 mm aluminium plate, 80 × 80 mm, to mount a NEMA 17 stepper motor at its centre with the pilot through, using the mount rows in the file I attached; plus four Ø5.5 mm through holes at the corners, 8 mm in from both edges, to screw the plate down.',
  files: [join(SAMPLE_ROWS, 'mounts.json')],
  async oracle(j) {
    // (The row's own numbers: 4 × Ø3.4 on a 31 mm square, the pilot Ø22 (+ its 0.5 clearance a side at most) through.)
    const row = (json(join(SAMPLE_ROWS, 'mounts.json')).rows as { id: string; holes: { spacing: number; diameter: number }; pilot: number; clearance: number }[]).find(r => r.id === 'nema17')!;
    const base = 80 * 80 * 6 - 4 * PI * 2.75 ** 2 * 6 - 4 * PI * (row.holes.diameter / 2) ** 2 * 6;
    const lo = base - PI * (row.pilot / 2 + row.clearance) ** 2 * 6, hi = base - PI * (row.pilot / 2) ** 2 * 6, got = volumeOf(j.base);
    const mount = allNodes(j.doc).some(n => /nema17/.test(JSON.stringify(n)));
    return [rowsFrom('rows', j.doc, 'mounts.json'), evaluates('builds', j.base), oneSolid('solids', j.base), size('size', j.base, [80, 80, 6]),
      check('volume', `volume between ${lo.toFixed(1)} and ${hi.toFixed(1)} mm³ (corner holes, the row's four Ø${row.holes.diameter} and its Ø${row.pilot} pilot through)`, got >= lo - 1 && got <= hi + 1, got, [lo, hi].map(v => +v.toFixed(1))),
      check('mount', 'a mount feature on the nema17 row', mount, mount)];
  },
};
const BEARING_SHAFT: Brief = {
  reference: [
    { tool: 'features', args: { action: 'load_rows', kind: 'bearings', file: '$file:bearings.json' } },
    { tool: 'features', args: { action: 'load_rows', kind: 'fits', file: '$file:fits.json' } },
    { tool: 'features', args: { action: 'command', command: 'shaft', values: { n: 3, d1: 20, l1: 30, d2: 25, l2: 40, d3: 20, l3: 25, r: 0, c: 0, ks: 0, gs: 0, x: 0, y: 0, z: 0 } } },
    { tool: 'features', args: { action: 'command', command: 'bearing', values: { row: '6204', step: 1, against: 'end', sc: 'k5' }, bodies: ['b0'] } },
    { tool: 'features', args: { action: 'material', material: 'steel' } }],
  id: 'bearing-shaft', ladder: 'standard sizes', title: 'stepped shaft with a 6204 (bearing and fit rows from the person\'s files)',
  prompt: 'A steel stepped shaft for a 6204 deep-groove ball bearing, using the bearing and fit rows in the files I attached: three steps along its axis — Ø20 mm × 30 mm (the bearing seat, class k5), then Ø25 mm × 40 mm, then Ø20 mm × 25 mm — with no fillets, chamfers, keyseat or groove. Put the 6204 on the first step against the Ø25 mm shoulder.',
  files: [join(A9_ROWS, 'bearings.json'), join(A9_ROWS, 'fits.json')],
  async oracle(j) {
    const bearingNode = allNodes(j.doc).find(n => n.kind === 'bearing'), shaft = solids(j.base).filter(b => !/bearing/.test(JSON.stringify(b.element ?? {})));
    // (The shaft alone: π(10²·30 + 12.5²·40 + 10²·25); the 6204's envelope by Pappus, the kernel's case (A9): 19 800.65 mm³.)
    const bearingBody = solids(j.base).find(b => Math.abs((b.volume ?? 0) - 19800.6522) < 20);
    const shaftBody = shaft.find(b => Math.abs((b.volume ?? 0) - PI * (100 * 30 + 156.25 * 40 + 100 * 25)) < 0.003 * PI * 11750);
    let against: Check;
    if (bearingBody && shaftBody) {
      // (Against the shoulder: one axial face of the bearing at the Ø25 step's end, along the shaft's longest axis.)
      const ax = [0, 1, 2].reduce((a, k) => (shaftBody.mesh.bounds.max[k] - shaftBody.mesh.bounds.min[k]) > (shaftBody.mesh.bounds.max[a] - shaftBody.mesh.bounds.min[a]) ? k : a, 0);
      const s0 = shaftBody.mesh.bounds.min[ax], s1 = shaftBody.mesh.bounds.max[ax], b0 = bearingBody.mesh.bounds.min[ax], b1 = bearingBody.mesh.bounds.max[ax];
      const ok = (near(b1, s0 + 30, 0.05) && near(b0, s0 + 16, 0.05)) || (near(b0, s1 - 30, 0.05) && near(b1, s1 - 16, 0.05));
      against = check('against', 'the 6204 on the Ø20 × 30 seat, against the Ø25 shoulder (14 mm wide)', ok, [b0 - s0, b1 - s0].map(v => +v.toFixed(3)), 'the bearing from 16 to 30 along the shaft (or mirrored)');
    } else against = check('against', 'the 6204 on its seat against the shoulder', false, 'no shaft or bearing body to read');
    return [rowsFrom('rows-b', j.doc, 'bearings.json'), rowsFrom('rows-f', j.doc, 'fits.json'), evaluates('builds', j.base),
      check('shaft', 'the shaft\'s volume π(10²·30 + 12.5²·40 + 10²·25) mm³ ±0.3 %', !!shaftBody, shaft.map(b => b.volume), +(PI * 11750).toFixed(3)),
      check('bearing', 'a 6204 bearing body (19 800.65 mm³, the row\'s envelope)', !!bearingBody && /6204/.test(JSON.stringify(bearingNode ?? {})), bearingBody?.volume ?? null, 19800.65),
      check('seat', 'the shaft seat class k5', /"k5"/.test(JSON.stringify(bearingNode ?? {})), bearingNode ? (bearingNode as { sc?: string }).sc ?? JSON.stringify(bearingNode).slice(0, 200) : null, 'k5'),
      against, hasMaterial('material', j.doc, /steel/, 'steel')];
  },
};
const GEAR_PAIR: Brief = {
  reference: [
    { tool: 'features', args: { action: 'command', command: 'gear', values: { m: 2, teeth: 20, b: 10, bore: 10, x: 0, y: 0, z: 0 } } },
    { tool: 'features', args: { action: 'command', command: 'gear-mesh', values: { teeth: 40, dir: 0, bore: 10 }, bodies: ['b0'] } },
    { tool: 'features', args: { action: 'material', material: 'steel' } }],
  id: 'gear-pair', ladder: 'assembly', title: 'meshing spur gear pair',
  prompt: 'Two steel spur gears that mesh: module 2, one with 20 teeth and one with 40 teeth, both 10 mm wide with Ø10 mm bores, on parallel axes 60 mm apart.',
  async oracle(j) {
    // (A gear's tip Ø is m(z + 2): 44 and 84 mm; its width 10 along its axis.)
    const bs = boxes(j).length ? boxes(j) : solids(j.base).map(b => ({ key: b.key, lo: b.mesh.bounds.min, hi: b.mesh.bounds.max, size: [0, 1, 2].map(k => b.mesh.bounds.max[k] - b.mesh.bounds.min[k]) }));
    const gear = (d: number) => bs.find(b => { const s = sorted(b.size); return near(s[0], 10, 0.05) && near(s[1], d, 0.3) && near(s[2], d, 0.3); });
    const g1 = gear(44), g2 = gear(84);
    let gap: number | null = null, parallel = false;
    if (g1 && g2) {
      const thin = (b: typeof g1) => b.size.indexOf(Math.min(...b.size)), a = thin(g1);
      parallel = a === thin(g2);
      const c1 = g1.lo.map((v, k) => (v + g1.hi[k]) / 2), c2 = g2.lo.map((v, k) => (v + g2.hi[k]) / 2);
      gap = Math.hypot(...[0, 1, 2].filter(k => k !== a).map(k => c1[k] - c2[k]));
    }
    const teeth = allNodes(j.doc).filter(n => /gear/.test(n.kind) || /"teeth"/.test(JSON.stringify(n))).map(n => JSON.stringify(n));
    const jr = await j.read('assembly', { action: 'joints' }), couplings = (jr.couplings ?? []).length;
    return [check('g20', 'a 20-tooth module-2 gear 10 wide (tip Ø44)', !!g1, g1 ? sorted(g1.size).map(v => +v.toFixed(2)) : null, [10, 44, 44]),
      check('g40', 'a 40-tooth module-2 gear 10 wide (tip Ø84)', !!g2, g2 ? sorted(g2.size).map(v => +v.toFixed(2)) : null, [10, 84, 84]),
      check('parallel', 'parallel axes', parallel, parallel),
      check('centres', 'axes 60 mm apart (m(z1 + z2)/2)', gap !== null && Math.abs(gap - 60) <= 0.05, gap === null ? null : +gap.toFixed(3), 60),
      check('meshed', 'the gears made as meshing gears (a gear-mesh feature, or a gear coupling the joint tree found)', teeth.some(t => /"mesh":\{/.test(t)) || couplings > 0, { gearNodes: teeth.length, couplings }, 'a meshing record', false),
      hasMaterial('material', j.doc, /steel/, 'steel', false)];
  },
};
const SCARA: Brief = {
  reference: [
    { tool: 'model', args: { source: 'const b = box({w: 80, d: 80, h: 10, x: -40, y: -40, z: 0})\nhole(b.top, {d: 10, x: 0, y: 0})' } },
    { tool: 'proposals', args: { action: 'propose', title: 'SCARA links', ops: [
      { tool: 'assembly', args: { action: 'add_part', name: 'Inner arm' } },
      { tool: 'model', args: { part: 'p1', source: 'const a = box({w: 360, d: 60, h: 20, x: -30, y: -30, z: 0})\nhole(a.top, {d: 10, x: 0, y: 0})\nhole(a.top, {d: 10, x: 300, y: 0})' } },
      { tool: 'assembly', args: { action: 'add_part', name: 'Outer arm' } },
      { tool: 'model', args: { part: 'p2', source: 'const a = box({w: 270, d: 20, h: 20, x: -30, y: -10, z: 0})\nhole(a.top, {d: 10, x: 0, y: 0})' } },
      { tool: 'assembly', args: { action: 'add_part', name: 'Quill' } },
      { tool: 'features', args: { part: 'p3', action: 'command', command: 'box', values: { w: 20, d: 20, h: 150, x: 0, y: 0, z: 0 } } },
      { tool: 'assembly', args: { action: 'add_mate', kind: 'concentric', a: { part: 'base', face: 'n2.side0' }, b: { part: 'p1', face: 'n2.side0' } } },
      { tool: 'assembly', args: { action: 'add_mate', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' } } },
      { tool: 'assembly', args: { action: 'add_mate', kind: 'concentric', a: { part: 'p1', face: 'n3.side0' }, b: { part: 'p2', face: 'n2.side0' } } },
      { tool: 'assembly', args: { action: 'add_mate', kind: 'coincident', a: { part: 'p1', face: 'n1.top' }, b: { part: 'p2', face: 'n1.bottom' } } },
      { tool: 'assembly', args: { action: 'add_mate', kind: 'coincident', a: { part: 'p2', face: 'n1.side1' }, b: { part: 'p3', face: 'n1.side3' } } },
      { tool: 'assembly', args: { action: 'add_mate', kind: 'coincident', a: { part: 'p2', face: 'n1.side0' }, b: { part: 'p3', face: 'n1.side0' }, flip: true } },
    ] } },
    { tool: '@accept', args: {} },
    { tool: 'proposals', args: { action: 'propose', title: 'SCARA joints', ops: [{ tool: 'assembly', args: { action: 'set_joints', joints: {
      'base~p1': { lower: -130 * DEG, upper: 130 * DEG, effort: 20, velocity: 3 }, 'p1~p2': { lower: -145 * DEG, upper: 145 * DEG, effort: 20, velocity: 3 }, 'p2~p3': { lower: 0, upper: 100, effort: 200, velocity: 500 } } } }] } },
    { tool: '@accept', args: {} }],
  id: 'scara', ladder: 'mechanism', title: 'SCARA arm from scratch (joints and limits)',
  prompt: 'A SCARA robot as an assembly, each link its own part placed by mates: a base; an inner arm turning about a vertical axis on the base; an outer arm turning about a vertical axis 300 mm from the first; and a quill sliding vertically through the outer arm\'s end, 250 mm from the second axis, with 100 mm of travel. Joint limits: ±130° and ±145° for the two turns, 0 to 100 mm for the slide; ratings 20 N·m and 3 rad/s for the turns, 200 N and 500 mm/s for the slide. The links\' shapes are yours to choose (aluminium bars and blocks are fine).',
  async oracle(j) {
    const js = await joints(j);
    if (!js) return [check('joints', 'the assembly reads as a robot (assembly.joints)', false, 'refused')];
    const turns = js.filter(x => x.type === 'revolute' || x.type === 'continuous'), slide = js.find(x => x.type === 'prismatic');
    const lim = (x: (typeof js)[number] | undefined, lo: number, hi: number, tol: number) => !!x?.limit && near(x.limit.lower, lo, tol) && near(x.limit.upper, hi, tol);
    const [t1, t2] = turns;
    // (A slide has no axis position — the engine gives its child's origin — so the slide's place is its part's middle.)
    const quill = slide ? boxes(j).filter(b => b.key.startsWith(`${slide.child}/`)) : [];
    const mid = quill.length ? [0, 1].map(k => (Math.min(...quill.map(b => b.lo[k])) + Math.max(...quill.map(b => b.hi[k]))) / 2) : null;
    return [check('kinds', 'two turning joints and one slide', turns.length === 2 && !!slide && js.length === 3, js.map(x => x.type), ['revolute', 'revolute', 'prismatic']),
      check('vertical', 'every axis vertical', js.length > 0 && js.every(x => vertical(x.axis)), js.map(x => x.axis.map(v => +v.toFixed(3)))),
      check('a1', 'second axis 300 mm from the first', !!t1 && !!t2 && near(axisGap(t1.origin, t2.origin), 300, 0.5), t1 && t2 ? +axisGap(t1.origin, t2.origin).toFixed(3) : null, 300),
      check('a2', 'the slide\'s part centred 250 mm from the second axis', !!t2 && !!mid && near(axisGap(t2.origin, mid), 250, 0.5), t2 && mid ? +axisGap(t2.origin, mid).toFixed(3) : null, 250),
      check('lim1', 'first turn ±130°', lim(t1, -130 * DEG, 130 * DEG, 0.01), t1?.limit ?? null, [-130 * DEG, 130 * DEG]),
      check('lim2', 'second turn ±145°', lim(t2, -145 * DEG, 145 * DEG, 0.01), t2?.limit ?? null, [-145 * DEG, 145 * DEG]),
      check('lim3', 'slide 0 to 100 mm', lim(slide, 0, 100, 0.5) || (!!slide?.limit && near((slide.limit.upper ?? 0) - (slide.limit.lower ?? 0), 100, 0.5)), slide?.limit ?? null, [0, 100]),
      check('ratings', 'ratings set (20 N·m, 3 rad/s; 200 N, 500 mm/s)', near(t1?.limit?.effort, 20, 0.01) && near(t2?.limit?.velocity, 3, 0.01) && near(slide?.limit?.effort, 200, 0.1) && near(slide?.limit?.velocity, 500, 0.5), js.map(x => [x.limit?.effort, x.limit?.velocity])),
      await noOverlap('overlap', j, false)];
  },
};
const MOTION: Brief = {
  id: 'arm-motion', ladder: 'mechanism', title: 'a saved motion on the 2R sample arm (RS2/RS3)',
  prompt: 'This is a 2R planar arm. Make a motion named "reach" that goes from the zero pose to the first joint at 60° and the second at −45°, a trapezoid profile at 2 rad/s and 10 rad/s². Check that it moves clear of collisions, and save the motion in the document.',
  start: join(ROBOTS, 'arm-2r.bcad'),
  async oracle(j, calls) {
    const motions = j.doc.robot?.motions ?? [], reach = motions.find(m => m.name === 'reach'), js = await joints(j) ?? [];
    const last = reach?.path.waypoints.at(-1) ?? {}, [k1, k2] = js.map(x => x.key);
    // (A saved motion's waypoints are in degrees and mm, RS2.)
    const hit = !!reach && near(last[k1], 60, 0.05) && near(last[k2], -45, 0.05);
    return [check('saved', 'a motion named "reach" saved in the document', !!reach, motions.map(m => m.name), ['reach']),
      check('pose', 'its last waypoint 60°, −45°', hit, last, { [k1]: 60, [k2]: -45 }),
      check('profile', 'trapezoid at 2 rad/s and 10 rad/s²', reach?.path.profile === 'trapezoid' && /"velocity":2\b/.test(JSON.stringify(reach.path.limits ?? {})), reach?.path ?? null, undefined, false),
      didCall('swept', calls, 'assembly', 'sweep', 'the move checked for collisions (assembly.sweep)', false)];
  },
};
const URDF: Brief = {
  reference: [{ tool: 'assembly', args: { action: 'urdf' } }, { tool: 'assembly', args: { action: 'mjcf' } }],
  id: 'scara-urdf', ladder: 'outputs', title: 'URDF and MJCF of the SCARA sample',
  prompt: 'Export this SCARA as URDF and as a MuJoCo MJCF model, and tell me each joint\'s limits.',
  start: join(ROBOTS, 'scara.bcad'),
  async oracle(j, calls) {
    const u = called(calls, 'assembly', 'urdf'), m = called(calls, 'assembly', 'mjcf');
    return [check('urdf', 'a URDF exported (assembly.urdf answered)', u.some(c => /<robot/.test(c.text)), u.length, '≥ 1'),
      check('mjcf', 'an MJCF exported (assembly.mjcf answered)', m.some(c => /<mujoco/.test(c.text)), m.length, '≥ 1'),
      (await reads('fresh', j, 'assembly', { action: 'urdf' }, 'a fresh URDF of the document checks')) as Check];
  },
};
const DRAWING: Brief = {
  reference: [
    { tool: 'model', args: { source: 'const p = box({w: 100, d: 60, h: 8, x: 0, y: 0, z: 0})\nfor (const x of [10, 90]) { for (const y of [10, 50]) { hole(p.top, {d: 6.6, x, y}) } }\nhole(p.top, {d: 20, x: 50, y: 30})' } },
    { tool: 'features', args: { action: 'material', material: 'steel' } },
    { tool: 'proposals', args: { action: 'propose', title: 'Drawing', ops: [{ tool: 'drawing', args: { action: 'set', sheet: 'A3', views: ['front', 'top', 'right', 'iso'] } }, { tool: 'drawing', args: { action: 'auto' } }, { tool: 'drawing', args: { action: 'fix' } }] } },
    { tool: '@accept', args: {} }],
  id: 'plate-drawing', ladder: 'outputs', title: 'A3 drawing of a plate',
  prompt: 'A steel plate 100 × 60 × 8 mm with four Ø6.6 mm through holes 10 mm in from each edge and a Ø20 mm hole through its centre. Make its A3 drawing with the front, top, right and isometric views, dimensioned, with no errors left on it.',
  async oracle(j) {
    const v = 100 * 60 * 8 - 4 * PI * 3.3 ** 2 * 8 - PI * 10 ** 2 * 8, d = j.doc.drawing as { sheet?: string; views?: string[]; dimensions?: unknown[] } | undefined;
    const issues = await j.read('drawing', { action: 'issues' }), errors = (issues.issues ?? []).filter((x: { severity: string }) => x.severity === 'error');
    const dims = JSON.stringify(d ?? {}).match(/"dim|"dimensions"/g)?.length ?? 0;
    return [evaluates('builds', j.base), size('size', j.base, [100, 60, 8]), volume('volume', j.base, v, 0.002),
      check('sheet', 'an A3 drawing', d?.sheet === 'A3', d?.sheet ?? null, 'A3'),
      // (No views set: all four. A right view that adds nothing is dropped by the layout (R14.3): not required.)
      check('views', 'the iso view shown (front and top always)', !!d && (!d.views || d.views.includes('iso')), d?.views ?? (d ? 'all four' : null), ['front', 'top', 'iso']),
      check('right', 'the right view kept', !!d && (!d.views || d.views.includes('right')), d?.views ?? (d ? 'all four' : null), 'right', false),
      check('dimensioned', 'dimensions on it (drawing.auto or accepted)', dims > 0, dims, '> 0'),
      check('errors', 'no error left (drawing.issues)', !issues.error && errors.length === 0, issues.error ?? errors.map((x: { code: string }) => x.code), [])];
  },
};
const CNC: Brief = {
  reference: [
    { tool: 'features', args: { action: 'stock', file: '$file:stock.json', allowance: 1 } },
    { tool: 'model', args: { source: 'const p = box({w: 200, d: 300, h: 14, x: 0, y: 0, z: 0})\nfor (const x of [20, 180]) { for (const y of [10, 290]) { hole(p.top, {d: 6.6, x, y}) } }\nconst t = box({w: 50, d: 30, h: 9, x: 30, y: 200, z: 6})\ndifference([p, t])' } },
    { tool: 'features', args: { action: 'material', material: 'al6061' } },
    { tool: 'requirements', args: { action: 'brief', fields: { purpose: { value: 'a plate', basis: 'assumed', why: 'test' }, process: { value: 'cnc-milling', basis: 'stated', source: 'CNC milled' }, material: { value: 'al6061', basis: 'stated', source: 'An aluminium 6061 plate' } } } },
    { tool: 'query', args: { action: 'cam', toolDiameter: 6 } }],
  id: 'cnc-plate', ladder: 'outputs', title: 'CNC plate: stock from the person\'s list, CAM preview',
  prompt: 'An aluminium 6061 plate 200 × 300 × 14 mm, CNC milled: four Ø6.6 mm through holes 20 mm in from its long sides and 10 mm in from its short ends, and a 50 × 30 mm pocket 8 mm deep with its corner 30 mm and 200 mm in (x 30–80, y 200–230). The shop\'s stock list is the file I attached. Give me the CAM preview with a Ø6 mm cutter.',
  files: [join(A9_ROWS, 'stock.json')],
  async oracle(j, calls) {
    const v = 200 * 300 * 14 - 50 * 30 * 8 - 4 * PI * 3.3 ** 2 * 14, cam = await j.read('query', { action: 'cam', toolDiameter: 6 });
    let pkg: { notForProduction?: boolean; setups?: unknown[] } = {};
    try { pkg = JSON.parse(cam.files?.[0]?.text ?? '{}'); } catch { /* none */ }
    return [rowsFrom('rows', j.doc, 'stock.json'), evaluates('builds', j.base), oneSolid('solids', j.base), size('size', j.base, [200, 300, 14]), volume('volume', j.base, v, 0.002),
      hasMaterial('material', j.doc, /6061/, 'aluminium 6061'), hasProcess('process', j.doc, /cnc|mill|machin/, 'process CNC milling'),
      check('cam', 'a fresh CAM preview of the document answers (NOT FOR PRODUCTION)', !cam.error && pkg.notForProduction === true && (pkg.setups?.length ?? 0) > 0, cam.error ?? `${pkg.setups?.length ?? 0} setups`),
      didCall('asked', calls, 'query', 'cam', 'the agent produced the CAM preview (query.cam)')];
  },
};
const CASTING: Brief = {
  reference: [
    { tool: 'features', args: { action: 'load_rows', kind: 'casting-rules', file: '$file:casting-rules.json' } },
    { tool: 'model', args: { source: 'const b = box({w: 120, d: 80, h: 15, x: 0, y: 0, z: 0})\nconst k = box({w: 40, d: 40, h: 50, x: 40, y: 20, z: 15})\nunion([b, k])' } },
    { tool: 'features', args: { action: 'material', material: 'a356' } },
    { tool: 'requirements', args: { action: 'brief', fields: { purpose: { value: 'a pedestal', basis: 'assumed', why: 'test' }, process: { value: 'sand-casting', basis: 'stated', source: 'to be sand cast' }, material: { value: 'a356', basis: 'assumed', why: 'an aluminium casting alloy' } } } },
    { tool: 'features', args: { action: 'casting', machined: ['n1.bottom'], gate: [60, 40, 65] } },
    { tool: 'query', args: { action: 'manufacturability' } }],
  id: 'sand-casting', ladder: 'outputs', title: 'sand-cast pedestal (casting rules from the person\'s file)',
  prompt: 'An aluminium pedestal to be sand cast, using the casting rules in the file I attached: a 120 × 80 × 15 mm base with a 40 × 40 × 50 mm boss standing on its centre (65 mm overall), the walls drafted for the pattern. The base\'s bottom face is machined after casting; the metal comes in at the centre of the boss\'s top. Give me the casting report.',
  files: [join(SAMPLE_ROWS, 'casting-rules.json')],
  async oracle(j, calls) {
    const report = await j.read('query', { action: 'manufacturability' }), rules = (report.rules ?? []) as { id: string; status: string; message?: string }[];
    const casting = j.doc.casting, got = sorted(sizeOf(j.base));
    return [rowsFrom('rows', j.doc, 'casting-rules.json'), evaluates('builds', j.base), oneSolid('solids', j.base),
      check('size', 'about 120 × 80 × 65 mm (draft may add a little)', got.length === 3 && near(got[0], 65, 1.5) && near(got[1], 80, 3) && near(got[2], 120, 3), got, [65, 80, 120]),
      hasProcess('process', j.doc, /sand/, 'process sand casting'), hasMaterial('material', j.doc, /^(al|a3)/, 'an aluminium casting alloy (al6061, a380, a356)'),
      check('machined', 'the machined face set (features.casting)', (casting?.machined?.length ?? 0) > 0, casting?.machined ?? null),
      check('gate', 'the gate set at the boss top', !!casting?.gate && near(casting.gate[2], Math.max(...solids(j.base).map(b => b.mesh.bounds.max[2])), 1), casting?.gate ?? null),
      check('report', 'the casting report answers with its rules read (no CASTING_RULE_ROW unknowns)', !report.error && rules.length > 0 && !rules.some(r => /CASTING_RULE_ROW/.test(r.message ?? '')), report.error ?? rules.map(r => `${r.id} ${r.status}`)),
      check('draft', 'no draft rule failing', rules.length > 0 && !rules.some(r => /draft/.test(r.id) && r.status === 'fail'), rules.filter(r => /draft/.test(r.id)).map(r => `${r.id} ${r.status}`), 'pass/warn', false),
      didCall('asked', calls, 'query', 'manufacturability', 'the agent read the casting report', false)];
  },
};
const STEP_3MF: Brief = {
  id: 'step-3mf', ladder: 'outputs', title: 'STEP and 3MF export of a puck',
  prompt: 'An aluminium puck Ø40 × 20 mm with a Ø8 mm hole through its centre. Export it as a STEP file and as a 3MF file.',
  async oracle(j, calls) {
    const text = calls.filter(c => c.ok).map(c => c.text).join('\n');
    return [evaluates('builds', j.base), size('size', j.base, [40, 40, 20]), volume('volume', j.base, PI * (20 ** 2 - 4 ** 2) * 20, 0.002),
      check('step', 'a STEP file from a tool (ISO-10303-21)', /ISO-10303-21/.test(text), /ISO-10303-21/.test(text)),
      // (A file a tool returned: a .3mf path or the 3MF core namespace — not the word in a description.)
      check('3mf', 'a 3MF file from a tool', /\.3mf"|3dmanufacturing/i.test(text), /\.3mf"|3dmanufacturing/i.test(text))];
  },
};

/** A9 (O5): the shaft-bearing-housing brief in a person's words, every standard size from the A9 rows (the fixture
 * standing in for the person's files), judged per element: rows, the four parts, placement, drawings, BOM and CSV. */
const A9_FILES = [...['sections', 'frame-stock', 'stock', 'bearings', 'fits', 'orings', 'fasteners'].map(n => join(A9_ROWS, `${n}.json`)), join(SAMPLE_ROWS, 'fastener-sizes.json')];
const A9: Brief = {
  reference: [
    ...['sections', 'frame-stock', 'stock'].map(n => ({ tool: 'features', args: n === 'sections' ? { action: 'frame_sections', file: '$file:sections.json' } : n === 'frame-stock' ? { action: 'frame_stock', file: '$file:frame-stock.json', kerf: 2 } : { action: 'stock', file: '$file:stock.json', allowance: 1 } })),
    ...[['bearings', 'bearings.json'], ['fits', 'fits.json'], ['orings', 'orings.json'], ['fasteners', 'fasteners.json'], ['fastener-sizes', 'fastener-sizes.json']].map(([kind, f]) => ({ tool: 'features', args: { action: 'load_rows', kind, file: `$file:${f}` } })),
    { tool: 'features', args: { action: 'command', command: 'frame', values: { skeleton: 'table', W: 400, D: 300, H: 300, x: 0, y: 0, z: 0, section: 'library', row: 'R40', corners: 'butt' } } },
    { tool: 'features', args: { action: 'material', material: 'steel' } },
    { tool: 'assembly', args: { action: 'add_part', name: 'Plate', position: [100, 0, 320] } },
    { tool: 'model', args: { part: 'p1', source: 'const p = box({w: 200, d: 300, h: 14, x: 0, y: 0, z: 0})\nfor (const x of [20, 180]) { for (const y of [10, 290]) { hole(p.top, {d: 6.6, x, y}) } }\nhole(p.top, {d: 47, x: 100, y: 150})\nconst t = box({w: 50, d: 30, h: 9, x: 30, y: 200, z: 6})\ndifference([p, t])' } },
    { tool: 'features', args: { part: 'p1', action: 'material', material: 'al6061' } },
    { tool: 'assembly', args: { action: 'add_part', name: 'Shaft', position: [200, 150, 255] } },
    { tool: 'features', args: { part: 'p2', action: 'command', command: 'shaft', values: { n: 3, d1: 20, l1: 25, d2: 25, l2: 40, d3: 20, l3: 30, r: 0, c: 0, ks: 0, gs: 0, x: 0, y: 0, z: 0 } } },
    { tool: 'features', args: { part: 'p2', action: 'command', command: 'bearing', values: { row: '6204', step: 3, against: 'start', sc: 'k5' }, bodies: ['b0'] } },
    { tool: 'features', args: { part: 'p2', action: 'material', material: 'steel' } },
    { tool: 'assembly', args: { action: 'add_part', name: 'Cover', position: [200, 150, 334] } },
    { tool: 'features', args: { part: 'p3', action: 'command', command: 'cylinder', values: { r: 30, h: 8, x: 0, y: 0, z: 0 } } },
    { tool: 'features', args: { part: 'p3', action: 'command', command: 'oring-gland', values: {}, faces: ['n1.top'] } },
    { tool: 'features', args: { part: 'p3', action: 'command', command: 'hole', faces: ['n1.top'], values: { d: 22, x: 0, y: 0 } } },
    { tool: 'features', args: { part: 'p3', action: 'material', material: 'petg' } },
    ...[[120, 10], [280, 10], [120, 290], [280, 290]].map(([x, y]) => ({ tool: 'features', args: { action: 'command', command: 'hole', faces: [y < 100 ? 'n0.m4.top' : 'n0.m6.top'], values: { type: 'tapped', thread: 'M6', tend: 'through', x, y } } })),
    ...[[120, 10], [280, 10], [120, 290], [280, 290]].map(([x, y]) => ({ tool: 'features', args: { action: 'command', command: 'fastener', values: { kind: 'socket-screw', size: 'M6', length: '20', joint: 'tapped', insert: 'instance', x, y, z: 334 } } })),
    { tool: 'proposals', args: { action: 'propose', title: 'Drawings', ops: ['p1', 'p2', 'p3'].flatMap(part => [{ tool: 'drawing', args: { action: 'set', sheet: 'A3', part } }, { tool: 'drawing', args: { action: 'auto', part } }]) } },
    { tool: '@accept', args: {} },
    { tool: 'query', args: { action: 'bom' } }, { tool: 'query', args: { action: 'purchase_csv' } }],
  id: 'a9-drive-unit', ladder: 'product', title: 'A9 bench drive unit (frame, plate, shaft + 6204, cover, screws; drawings, BOM, CSV)',
  prompt: [
    'A bench drive unit, as an assembly. Every standard size comes from the files I attached (sections, frame stock, machining stock, bearings, fits, O-rings, fasteners, fastener sizes); do not make up rows.',
    '1. Frame — the base part, steel: a welded table frame 400 × 300 mm and 300 mm high of the R40 tube from the section file, butt corners.',
    '2. Plate — aluminium 6061, CNC milled: 200 × 300 × 14 mm, lying flat on the frame\'s top rails and spanning its two long rails, with four Ø6.6 mm through holes over the rails (20 mm in from its long sides, 10 mm in from its ends), a Ø47 mm bore through its centre for the bearing (H7), and a 50 × 30 mm pocket 8 mm deep.',
    '3. Shaft — steel, CNC turned, standing up through the plate\'s bore: from the bottom, Ø20 × 25 mm, Ø25 × 40 mm, Ø20 × 30 mm; a 6204 bearing on the top step, its lower face against the Ø25 shoulder (seat k5), housed in the plate\'s bore (its 14 mm in the plate\'s 14), the shaft\'s end coming up through the cover\'s hole.',
    '4. Cover — PETG, FDM printed: Ø60 × 8 mm, sitting on the plate over the bore, with a face gland for the 214 O-ring and a Ø22 mm hole for the shaft\'s end.',
    '5. Four M6 × 20 socket head cap screws through the plate\'s holes into M6 tapped holes in the rails\' top walls, each screw its own part.',
    'Then give me an A3 drawing of each part, the bill of materials and the purchase list (CSV).',
  ].join('\n'),
  files: A9_FILES,
  async oracle(j, calls) {
    const insts = j.doc.instances ?? [], partBy = (re: RegExp) => insts.find(i => re.test(i.name ?? ''));
    const plate = partBy(/plate/i), shaft = partBy(/shaft/i), cover = partBy(/cover/i);
    const pb = plate ? j.parts[plate.id] : null, sb = shaft ? j.parts[shaft.id] : null, cb = cover ? j.parts[cover.id] : null;
    const frameNodes = j.doc.nodes.filter(n => n.kind === 'frame' || n.kind === 'frame-member');
    const members = solids(j.base).length, fsize = sorted(sizeOf(j.base));
    const screws = allNodes(j.doc).filter(n => /"fastener"|socket-screw/.test(JSON.stringify(n))).length + insts.filter(i => /screw|M6/i.test(i.name ?? '')).length;
    const bom = await j.read('query', { action: 'bom' }), csv = await j.read('query', { action: 'purchase_csv' });
    const bomText = JSON.stringify(bom), csvText = String(csv.files?.[0]?.text ?? '');
    const drawn = [plate, shaft, cover].filter(p => p && (p.doc.drawing as { sheet?: string } | undefined)?.sheet === 'A3').length;
    // (Placement, world boxes: the plate on the frame's top, the cover on the plate, the shaft through the plate's bore.)
    const bx = boxes(j), top = (key: RegExp) => bx.filter(b => key.test(b.key));
    // (A part's own body is its largest: the cover's bought O-ring stands proud of its gland by the squeeze, into the plate.)
    const own = (bs: typeof bx) => bs.length ? [bs.reduce((a, b) => a.size[0] * a.size[1] * a.size[2] >= b.size[0] * b.size[1] * b.size[2] ? a : b)] : [];
    const plateBox = plate ? top(new RegExp(`^${plate.id}/`)) : [], coverBox = cover ? own(top(new RegExp(`^${cover.id}/`))) : [], frameBox = top(/^b|^base/), shaftBox = shaft ? top(new RegExp(`^${shaft.id}/`)) : [];
    const zmax = (bs: typeof bx) => bs.length ? Math.max(...bs.map(b => b.hi[2])) : NaN, zmin = (bs: typeof bx) => bs.length ? Math.min(...bs.map(b => b.lo[2])) : NaN;
    const centre = (bs: typeof bx) => bs.length ? [0, 1].map(k => (Math.min(...bs.map(b => b.lo[k])) + Math.max(...bs.map(b => b.hi[k]))) / 2) : [NaN, NaN];
    const pc = centre(plateBox), sc = centre(shaftBox.slice(0, 1));
    const plateV = 200 * 300 * 14 - 50 * 30 * 8 - 4 * PI * 3.3 ** 2 * 14 - PI * 23.5 ** 2 * 14;
    return [
      ...['sections.json', 'bearings.json', 'fasteners.json', 'orings.json'].map((f, k) => rowsFrom(`rows${k}`, j.doc, f, k < 2)),
      // (400 × 300 read either way: the skeleton's centre lines, or outside — 440 × 340 on R40.)
      check('frame', 'the frame: R40 members (8 at least) on a table skeleton, 400 × 300 (centre lines or outside)', frameNodes.length > 0 && members >= 8 && ((near(fsize[2], 400, 2) && near(fsize[1], 300, 2)) || (near(fsize[2], 440, 2) && near(fsize[1], 340, 2))), { members, size: fsize }, '8 members, 400 × 300 or 440 × 340'),
      hasMaterial('steel', j.doc, /steel/, 'steel frame and shaft'),
      check('plate', 'the plate 200 × 300 × 14 with its holes, bore and pocket (volume ±0.3 %)', !!pb && near(volumeOf(pb), plateV, 0.003 * plateV), pb ? volumeOf(pb) : 'no part named plate', +plateV.toFixed(1)),
      check('shaft', 'the shaft part with a 6204 bearing on it', !!shaft && /6204/.test(JSON.stringify(shaft.doc.nodes)) && (sb ?? []).length >= 2, shaft ? (sb ?? []).length : 'no part named shaft'),
      // (The cover's own body, the largest: its bought O-ring stands proud of the gland by its squeeze.)
      check('cover', 'the cover Ø60 × 8 with a 214 face gland', !!cover && near(sorted(sizeOf(biggest(cb)))[0], 8, 0.2) && near(sorted(sizeOf(biggest(cb)))[2], 60, 0.2) && /214/.test(JSON.stringify(cover.doc.nodes)), cover ? sorted(sizeOf(biggest(cb))) : 'no part named cover'),
      check('screws', 'four M6 × 20 cap screws', screws >= 4, screws, 4),
      check('plate-on-frame', 'the plate lies on the frame\'s top', near(zmin(plateBox), zmax(frameBox), 0.5), [zmin(plateBox), zmax(frameBox)].map(v => +v.toFixed(2))),
      check('cover-on-plate', 'the cover sits on the plate', near(zmin(coverBox), zmax(plateBox), 0.5), [zmin(coverBox), zmax(plateBox)].map(v => +v.toFixed(2))),
      check('shaft-in-bore', 'the shaft stands in the plate\'s bore (axis at the plate\'s centre)', near(Math.hypot(pc[0] - sc[0], pc[1] - sc[1]), 0, 0.5), [pc, sc].map(v => v.map(x => +x.toFixed(2)))),
      await noOverlap('overlap', j, true, true),
      check('drawings', 'an A3 drawing of the plate, the shaft and the cover', drawn === 3, drawn, 3),
      check('bom', 'the BOM answers with the 6204 and the 214 bought', !bom.error && /6204/.test(bomText) && /214/.test(bomText), bom.error ?? 'answered'),
      check('csv', 'the purchase CSV lists the screws, the bearing and the O-ring', /6204/.test(csvText) && /214/.test(csvText) && /M6/.test(csvText), csv.error ?? csvText.split('\n').length),
      didCall('asked-bom', calls, 'query', 'bom', 'the agent produced the BOM', false), didCall('asked-csv', calls, 'query', 'purchase_csv', 'the agent produced the purchase CSV', false),
    ];
  },
};

/**
 * P1 (P1-L3): the single-cylinder engine, the API lane's brief (brief.md, its words as the person's message) judged by
 * its own checks (check.ts through its run.mjs --check, a process of its own: parts, solves, cycle, timing, sweep,
 * masses, balance). The fastener sizes it names are attached as the person's file. Listed only when the folder has
 * them: AI_EVAL_P1_DIR, else examples/products/engine-1cyl.
 */
const P1_DIR = process.env.AI_EVAL_P1_DIR ?? join(REPO, 'examples/products/engine-1cyl');
const P1: Brief | null = existsSync(join(P1_DIR, 'brief.md')) && existsSync(join(P1_DIR, 'check.ts')) ? {
  id: 'p1-engine', ladder: 'product', title: 'P1 single-cylinder four-stroke engine (the API lane\'s brief and checks)',
  prompt: readFileSync(join(P1_DIR, 'brief.md'), 'utf8').trim() + '\n\nI attached the fastener sizes file (fastener-sizes.json).',
  files: [join(SAMPLE_ROWS, 'fastener-sizes.json')],
  caps: { maxCalls: 400, maxTurns: 8, wallMin: 100 },
  async oracle(j) {
    const file = join(tmpdir(), `ai-eval-p1-${process.pid}-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify(j.doc));
    const out = spawnSync(process.execPath, [join(P1_DIR, 'run.mjs'), '--check', file], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 20 * 60_000 });
    rmSync(file, { force: true });
    let r: { checks?: { id: string; ok: boolean; detail: string }[]; figures?: unknown } = {};
    try { r = JSON.parse(out.stdout); } catch { return [check('p1', 'P1\'s check ran', false, (out.stderr || out.stdout || '').slice(0, 600))]; }
    // (check.ts is the API lane's and still changes: the version that judged is recorded by its hash.)
    const checkSha = createHash('sha256').update(readFileSync(join(P1_DIR, 'check.ts'))).digest('hex').slice(0, 16);
    return [...(r.checks ?? []).map(c => check(c.id, `P1: ${c.id}`, c.ok, c.detail.slice(0, 400))), check('figures', 'P1\'s figures and the check.ts that judged', true, { ...(r.figures as object), checkSha }, undefined, false)];
  },
} : null;

export const BRIEFS: Brief[] = [
  // single parts
  rb9(1, 'single part'), rb9(4, 'single part'), FLANGED_SHAFT, rb9(5, 'single part'), rb9(3, 'single part'),
  // standard sizes from the person's files
  TAPPED_PLATE, MOTOR_PLATE, BEARING_SHAFT,
  // assemblies
  rb9(7, 'assembly', { baseAsInstance: true }), GEAR_PAIR, rb9(12, 'assembly', { baseAsInstance: true }),
  // mechanisms and robots
  rb9(14, 'mechanism'), SCARA, MOTION, rb9(11, 'mechanism', { flatten: true }),
  // manufacturing outputs
  DRAWING, CNC, CASTING, STEP_3MF, URDF, rb9(9, 'outputs'),
  // products
  rb9(13, 'product'), A9, ...(P1 ? [P1] : []),
  // long, descriptive prompts, scored per element
  ...LONG_BRIEFS,
];
