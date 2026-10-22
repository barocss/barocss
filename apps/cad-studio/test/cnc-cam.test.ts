import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { camPreview, camSvg, inset, NOT_FOR_PRODUCTION, type DrillPoint, type PocketPass } from '@barocss/cad-model/machining/cam';

// CNC8 (O103): the 2.5D preview, NOT FOR PRODUCTION, against closed forms — a 50 × 30 pocket 8 deep with a Ø6 tool:
// loops (44 − 4.8k) × (24 − 4.8k) for k = 0…4 (the stepover 2.4, 40 % of 6), levels 3, 6, 8 (the step-down 3), length
// 3 · Σ 2(68 − 9.6k) = 1464; its corners filleted r 5, the first loop's corners r 2 and later ones sharp; the mutant a
// Ø32 tool — none fits, said; drill points at each open end; slots and steps listed, not previewed; every file says so.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
const POCKET = (r?: number): [string, Record<string, unknown>][] => [cmd('box', { w: 120, d: 80, h: 20, x: 0, y: 0, z: 0 }), cmd('box', { w: 50, d: 30, h: 20, x: 35, y: 25, z: 12 }), ['run_command', { command: 'difference', values: {}, bodies: ['b1', 'b3'] }],
  ...(r ? [cmd('fillet', { radius: r }, { edges: [0, 1, 2, 3].map(k => ({ between: [`n3.side${k}`, `n3.side${(k + 1) % 4}`] })) })] : [])];
const box = (l: readonly (readonly number[])[]) => { const xs = l.map(p => p[0]), ys = l.map(p => p[1]); return [+(Math.max(...xs) - Math.min(...xs)).toFixed(6), +(Math.max(...ys) - Math.min(...ys)).toFixed(6)]; };

test('CNC8 inset: a 10 × 4 rectangle by 1 — 8 × 2; by 2 — closed up (null); a chord polygon past its corner radius turns sharp', () => {
  const r: [number, number][] = [[0, 0], [10, 0], [10, 4], [0, 4]];
  assert.deepEqual(box(inset(r, 1)!), [8, 2]); assert.equal(inset(r, 2), null);
  // (A rounded square 20 × 20, corners r 2 as 8-chord arcs, inset by 3: its corners gone sharp, 14 × 14.)
  const rounded: [number, number][] = [];
  for (const [cx, cy, a0] of [[18, 2, -90], [18, 18, 0], [2, 18, 90], [2, 2, 180]] as const) for (let k = 0; k <= 8; k++) { const a = (a0 + 90 * k / 8) * Math.PI / 180; rounded.push([cx + 2 * Math.cos(a), cy + 2 * Math.sin(a)]); }
  assert.deepEqual(box(inset(rounded, 3)!), [14, 14]);
});

test('CNC8 a 50 × 30 pocket, 8 deep, Ø6 tool (an estimate): loops (44 − 4.8k) × (24 − 4.8k), k = 0…4; levels 3, 6, 8; length 1464; the plane +Z at the floor', async () => {
  const s = await build(POCKET()), p = camPreview(s.doc, s.bodies), pk = p.operations.find((o): o is PocketPass => o.kind === 'pocket')!;
  assert.deepEqual([p.notForProduction, p.banner, p.tool, p.stepoverMM, p.stepdownMM], [true, NOT_FOR_PRODUCTION, { diameterMM: 6, basis: 'estimate' }, 2.4, 3]);
  assert.deepEqual(pk.loops.map(box), [0, 1, 2, 3, 4].map(k => [+(44 - 4.8 * k).toFixed(6), +(24 - 4.8 * k).toFixed(6)]));
  assert.deepEqual(pk.levels, [3, 6, 8]); assert.ok(Math.abs(pk.lengthMM - 3 * [0, 1, 2, 3, 4].reduce((t, k) => t + 2 * (68 - 9.6 * k), 0)) <= 1e-6, String(pk.lengthMM));
  assert.deepEqual([pk.setup, pk.plane.normal, pk.plane.origin[2]], ['+Z', [0, 0, 1], 12]);
  // (The mutant: a Ø32 tool in a 30-wide pocket — no loop, said.)
  const big = camPreview(s.doc, s.bodies, { toolMM: 32 }).operations.find((o): o is PocketPass => o.kind === 'pocket')!;
  assert.deepEqual([big.loops.length, big.note], [0, 'the tool (Ø32) does not fit the pocket (30 wide)']);
});

test('CNC8 the pocket filleted r 5, Ø6: the first loop 44 × 24 with corners r 2 (its length 2(44 + 24) − 16 + 4π within the chord), later loops sharp-cornered', async () => {
  const s = await build(POCKET(5)), pk = camPreview(s.doc, s.bodies).operations.find((o): o is PocketPass => o.kind === 'pocket')!;
  assert.deepEqual(pk.loops.map(box), [0, 1, 2, 3, 4].map(k => [+(44 - 4.8 * k).toFixed(6), +(24 - 4.8 * k).toFixed(6)]));
  const per = (l: readonly (readonly number[])[]) => l.reduce((t, q, i) => { const r = l[(i + 1) % l.length]; return t + Math.hypot(r[0] - q[0], r[1] - q[1]); }, 0);
  const round = 2 * (44 + 24) - 16 + 4 * Math.PI; assert.ok(per(pk.loops[0]) < round + 1e-6 && per(pk.loops[0]) > round - 0.2, String(per(pk.loops[0])));
  assert.ok(Math.abs(per(pk.loops[2]) - 2 * (34.4 + 14.4)) <= 1e-6, 'sharp by the third loop');
});

test('CNC8 holes and the rest: Ø6.6 through 20 — from +Z down to z 0 and from −Z up to z 20, 20 deep; Ø5 blind — from +Z, 10; both wider than the Ø4 tool, so circular pockets (O161, F3), a hole of the tool\'s size a drill point; a slot listed, not previewed; a given tool said given', async () => {
  const s = await build([cmd('box', { w: 60, d: 40, h: 20, x: 0, y: 0, z: 0 }), cmd('hole', { d: 6.6, x: 15, y: 20 }, { faces: ['n1.top'] }), cmd('hole', { type: 'blind', d: 5, depth: 10, x: 45, y: 20 }, { faces: ['n1.top'] }),
    cmd('box', { w: 8, d: 60, h: 20, x: 26, y: -10, z: 16 }), ['run_command', { command: 'difference', values: {}, bodies: ['b3', 'b5'] }]]);
  const p = camPreview(s.doc, s.bodies, { toolMM: 4 });
  // (The preview lists each direction a hole is reachable from; the package makes each once, O161 F2.)
  const bores = p.operations.filter((o): o is PocketPass => o.kind === 'pocket' && !!o.note).map(o => [o.setup, o.plane.origin[2], o.plane.normal[2], o.levels.at(-1), o.note]);
  assert.deepEqual(bores, [['+Z', 0, 1, 20, 'Ø6.6 is wider than the Ø4 tool: milled as a circular pocket, not drilled'], ['−Z', 20, -1, 20, 'Ø6.6 is wider than the Ø4 tool: milled as a circular pocket, not drilled'], ['+Z', 10, 1, 10, 'Ø5 is wider than the Ø4 tool: milled as a circular pocket, not drilled']]);
  assert.deepEqual(p.operations.filter((o): o is DrillPoint => o.kind === 'drill'), []);
  const fit = camPreview(s.doc, s.bodies, { toolMM: 5 }).operations.filter((o): o is DrillPoint => o.kind === 'drill').map(d => [d.setup, d.at[2], d.axis[2], d.depthMM, d.diameterMM]);
  assert.deepEqual(fit, [['+Z', 20, -1, 10, 5]], 'the Ø5 hole with a Ø5 tool: a drill point');
  assert.deepEqual(p.skipped.map(x => x.why), ['a slot is open on a side: not previewed']); assert.deepEqual(p.tool, { diameterMM: 4, basis: 'given' });
  const svg = camSvg(camPreview(s.doc, s.bodies, { toolMM: 5 }), '+Z'); assert.ok(svg.startsWith(`<!-- ${NOT_FOR_PRODUCTION} -->`)); assert.match(svg, /<circle /);
  assert.match(camSvg(p, '+Z'), /<polygon /, 'the circular pockets\' loops');
});

test('CNC8 cad-cli cam-preview: the JSON\'s first key and each SVG\'s first line say NOT FOR PRODUCTION; no G-code in any file', async () => {
  const s = await build(POCKET()), dir = mkdtempSync(join(tmpdir(), 'cnc-cam-')), part = join(dir, 'p.bcad'); writeFileSync(part, encodeStudioFile(s.doc));
  const r = spawnSync(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), 'cam-preview', part, '-o', join(dir, 'out')], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const files = readdirSync(join(dir, 'out')).sort(); assert.deepEqual(files, ['cam-preview-pZ.svg', 'cam-preview.json']);
  const json = readFileSync(join(dir, 'out/cam-preview.json'), 'utf8');
  assert.equal(Object.keys(JSON.parse(json))[0], 'banner'); assert.match(json.split('\n')[1], /NOT FOR PRODUCTION/);
  assert.match(readFileSync(join(dir, 'out/cam-preview-pZ.svg'), 'utf8').split('\n')[0], /NOT FOR PRODUCTION/);
  for (const f of files) assert.ok(!/\bG0?[0123]\b|\bM0?[36]\b/.test(readFileSync(join(dir, 'out', f), 'utf8')), `${f}: no G-code`);
});
