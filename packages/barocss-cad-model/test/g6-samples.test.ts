import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { draftField, draftSamples } from '../src/mould/draft';
import { isoclinePolylines } from '../src/mould/parting';
import { accessOf, accessSamples } from '../src/machining/access';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { castability, castingDraftLimits } from '../src/casting/report';
import { processProfile } from '../src/library/materials';
import { withLook } from '../src/app/bodies';
import { withSampleRows } from './person-file';

// O-G6 (the GPU lane's analysis maps): per-vertex draft, per-triangle access and isocline polylines, new exports beside
// the reports they sample — against closed forms and the reports themselves: a 3° cone's side 3° at every vertex; the
// draft's sign changes on exactly the faces draftField calls straddling; the access shares, area-weighted, are accessOf's
// unreached area; a cylinder across the pull gives two open polylines on its generators, each its length.

const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const extrude = (sketch: Record<string, unknown>, h: number, draft?: number): StudioDoc => withNode(withNode(emptyDoc(), sketch as never), { kind: 'extrude', sketch: 0, height: h, ...(draft !== undefined ? { draft } : {}) });
const CONE = extrude({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 }, 30, 3);
const ACROSS = extrude({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, 40);
const BOX = extrude({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, 10, 2);
const faceOf = (b: BodyResult, i: number) => b.mesh.faces.find(f => f.index === b.mesh.faceOfVertex[i])!.name.split('+')[0];

test('O-G6 draftSamples: a cone drafted 3° — every vertex of its side 3 within 1e-9, its top +90 and bottom −90; one value a display vertex', () => {
  const [b] = bodiesOf(CONE), s = draftSamples(CONE, b, [0, 0, 1]);
  assert.equal(s.length, b.mesh.faceOfVertex.length);
  for (let i = 0; i < s.length; i++) {
    const f = faceOf(b, i), want = f === 'n1.side0' ? 3 : f === 'n1.top' ? 90 : f === 'n1.bottom' ? -90 : NaN;
    // (Float32: within its rounding of the exact value, which is within 1e-9 of 3.)
    assert.ok(Math.abs(s[i] - Math.fround(want)) <= 1e-9 || Math.abs(s[i] - want) <= 4e-6 * Math.abs(want), `${f} vertex ${i}: ${s[i]}`);
  }
  // (The exact values before Float32: draftField's own minimum and maximum on the side, 3 to 1e-9.)
  const side = draftField(CONE, [b], [0, 0, 1], 1).faces.find(x => x.face === 'n1.side0')!;
  assert.ok(Math.abs(side.min - 3) <= 1e-9 && Math.abs(side.max - 3) <= 1e-9);
});

test('O-G6 draftSamples: its sign changes on exactly the faces draftField calls straddling — a cylinder across the pull, a drafted box, a cone, pulled along Z and X', () => {
  let straddling = 0;
  for (const [doc, pull] of [[ACROSS, [0, 0, 1]], [ACROSS, [1, 0, 0]], [BOX, [0, 0, 1]], [BOX, [1, 0, 0]], [CONE, [0, 0, 1]], [CONE, [0, 1, 0]]] as const) {
    const [b] = bodiesOf(doc), s = draftSamples(doc, b, pull), field = draftField(doc, [b], pull, 0).faces;
    const pos = new Set<string>(), neg = new Set<string>();
    for (let i = 0; i < s.length; i++) { if (s[i] > 1e-9) pos.add(faceOf(b, i)); if (s[i] < -1e-9) neg.add(faceOf(b, i)); }
    for (const f of field) assert.equal(pos.has(f.face) && neg.has(f.face), f.cls === 'straddle', `${f.face} along ${pull}: ${f.cls}`);
    straddling += field.filter(f => f.cls === 'straddle').length;
  }
  assert.ok(straddling >= 2, `straddling faces among the cases: ${straddling}`);
});

async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [] } as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, async d => evaluateDoc(d, 1)); assert.ok(!r.isError, r.content); s = r.state; }
  return s;
}
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
const triArea = (b: BodyResult, t: number) => { const P = b.mesh.positions, I = b.mesh.indices, a = 3 * I[3 * t], c = 3 * I[3 * t + 1], d = 3 * I[3 * t + 2]; const u = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]], v = [P[d] - P[a], P[d + 1] - P[a + 1], P[d + 2] - P[a + 2]]; return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; };

test('O-G6 accessSamples: a block with a sealed void and one with a side slot sealed 1 mm short — the shares, area-weighted, are accessOf\'s unreachedArea (2 · 200 and 760); the void\'s triangles all hidden, mask 0; the block\'s top reached from +Z', async () => {
  const voided = await build([cmd('box', { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 }), cmd('box', { w: 10, d: 10, h: 5, x: 15, y: 10, z: 7.5 }), cmd('difference', {}, { bodies: ['b1', 'b3'] })]);
  const sealed = await build([cmd('box', { w: 40, d: 30, h: 20, x: 0, y: 0, z: 0 }), cmd('box', { w: 10, d: 20, h: 6, x: 29, y: 5, z: 7 }), cmd('difference', {}, { bodies: ['b1', 'b3'] })]);
  for (const [s, want] of [[voided, 400], [sealed, 760]] as const) {
    const a = accessOf(s.bodies), per = accessSamples(s.bodies);
    assert.equal(per.length, s.bodies.length);
    let sum = 0;
    per.forEach((p, k) => { const b = s.bodies[k]; assert.equal(p.unreachedShare.length, b.mesh.indices.length / 3); assert.equal(p.mask.length, b.mesh.indices.length / 3); for (let t = 0; t < p.unreachedShare.length; t++) sum += p.unreachedShare[t] * triArea(b, t); });
    // (Float32 shares: to their rounding, a part in 1e7 of the area.)
    assert.ok(Math.abs(sum - a.unreachedArea) <= 1e-6 * Math.max(1, a.unreachedArea), `${sum} vs ${a.unreachedArea}`);
    assert.ok(Math.abs(a.unreachedArea - want) <= 1e-6, String(a.unreachedArea));
    const b = s.bodies[0], p = per[0];
    for (let t = 0; t < p.mask.length; t++) {
      const f = b.mesh.faces.find(x => x.index === b.mesh.faceOfVertex[b.mesh.indices[3 * t]])!.name;
      if (f.startsWith('n3.') && want === 400) assert.deepEqual([p.mask[t], p.unreachedShare[t]], [0, 1], `${f} ${t}`);
      if (f === 'n1.top') assert.ok(p.mask[t] & (1 << 4), `${f}: +Z`);
    }
  }
});

test('O-G6 isoclinePolylines: a cylinder r 10 × 40 lying along X, pulled along Z — two open polylines on its generators at z = 0, each 40 long; a cone pulled along Z — none', () => {
  const [b] = bodiesOf(ACROSS), lines = isoclinePolylines(ACROSS, b, [0, 0, 1]);
  assert.equal(lines.length, 2, JSON.stringify(lines.map(l => [l.face, l.points.length, l.closed])));
  for (const l of lines) {
    assert.equal(l.closed, false);
    let len = 0; for (let i = 1; i < l.points.length; i++) len += Math.hypot(...([0, 1, 2] as const).map(k => l.points[i][k] - l.points[i - 1][k]) as [number, number, number]);
    assert.ok(Math.abs(len - 40) <= 1e-6, `${l.face}: ${len}`);
    for (const p of l.points) assert.ok(Math.abs(p[2]) <= 1e-9, `on z = 0: ${p}`);
  }
  assert.deepEqual(new Set(lines.map(l => Math.sign(l.points[0][1]))), new Set([1, -1]), 'one each side');
  assert.deepEqual(isoclinePolylines(CONE, bodiesOf(CONE)[0], [0, 0, 1]), []);
});

test('O-G6 castingDraftLimits: an A380 die casting\'s least and achievable draft, the limits its report judges by (the rule\'s limit one of them); no material, none', () => {
  const plain = extrude({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, 10, 0.75), die = processProfile('die-casting')!;
  const [b0] = bodiesOf(plain);
  assert.equal(castingDraftLimits(plain, [b0], die), null);
  // (O7c: the casting rules are the sample rows, loaded as the person loads them.)
  const doc = withSampleRows({ ...withLook(plain, b0, { material: 'a380' }), process: 'die-casting', mould: { version: 1 as const, pull: [0, 0, 1] as [number, number, number] } }, 'casting-rules');
  const bodies = bodiesOf(doc), lim = castingDraftLimits(doc, bodies, die);
  assert.ok(lim && lim.draftMin > 0 && (lim.draftRecommended === null || lim.draftRecommended >= lim.draftMin), JSON.stringify(lim));
  const rule = castability(doc, bodies, die).rules.find(r => r.id === 'draft')!;
  assert.ok(rule.limit === lim!.draftMin || rule.limit === lim!.draftRecommended, `${rule.limit} vs ${JSON.stringify(lim)}`);
});
