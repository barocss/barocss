import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { NOT_FOR_PRODUCTION } from '../src/machining/cam';
import { camPackage, type Move, type SetupProgram } from '../src/machining/camPackage';

// G23's data side, B: CNC8's preview as an ordered tool-tip program — NOT FOR PRODUCTION. CNC8's 50 × 30 pocket, 8 deep, Ø6
// (an estimate): one +Z setup, the identity frame; every rapid at the safe height (the stock's top + 5) and nothing else
// below it but plunges, ramps, feeds and retracts going straight up; the loops fed at z 17, 14 and 12; the feed moves'
// swept volume the pocket's 50·30·8 less at most its four corners' 4(1 − π/4)R² a mm of depth, the flat tool's bound.
// The block stock as a box; with none loaded, the refusal. CNC8's holes: plunges to their bottoms and retracts.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const cmd = (command: string, values: Record<string, unknown>, sel: Record<string, unknown> = {}): [string, Record<string, unknown>] => ['run_command', { command, values, ...sel }];
async function build(calls: [string, Record<string, unknown>][]): Promise<ChatState> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [tool, args] of calls) { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; }
  return s;
}
const POCKET: [string, Record<string, unknown>][] = [cmd('box', { w: 120, d: 80, h: 20, x: 0, y: 0, z: 0 }), cmd('box', { w: 50, d: 30, h: 20, x: 35, y: 25, z: 12 }), ['run_command', { command: 'difference', values: {}, bodies: ['b1', 'b3'] }]];
const withStock = (doc: StudioDoc): StudioDoc => ({ ...doc, machining: { version: 1, stock: [{ id: 'B1', kind: 'block', size: [125, 85, 25], source: 'the test\'s list' }] } });
/** The linking rule: a rapid only at the safe height; a retract straight up; below the safe height only cutting or entering moves. */
function linkingHolds(s: SetupProgram) {
  for (const m of s.moves) {
    if (m.kind === 'rapid') assert.ok(Math.abs(m.a[2] - s.safeZ.value) < 1e-9 && Math.abs(m.b[2] - s.safeZ.value) < 1e-9, `a rapid below the safe height: ${JSON.stringify(m)}`);
    if (m.kind === 'retract') assert.ok(m.a[0] === m.b[0] && m.a[1] === m.b[1] && m.b[2] >= m.a[2], `a retract not straight up: ${JSON.stringify(m)}`);
  }
  // (The program is continuous: each move starts where the last ended.)
  for (let i = 1; i < s.moves.length; i++) assert.ok(Math.hypot(...[0, 1, 2].map(k => s.moves[i].a[k] - s.moves[i - 1].b[k])) < 1e-9, `a jump before move ${i}`);
}
const segDist2 = (px: number, py: number, m: Move) => { const dx = m.b[0] - m.a[0], dy = m.b[1] - m.a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((px - m.a[0]) * dx + (py - m.a[1]) * dy) / l2)) : 0; const x = m.a[0] + t * dx - px, y = m.a[1] + t * dy - py; return x * x + y * y; };

test('B: CNC8\'s 50 × 30 pocket — NOT FOR PRODUCTION first; the whole tool; one +Z setup, the identity frame; the linking rule; loops at z 17, 14, 12; the block stock as a box', async () => {
  const s = await build(POCKET), p = camPackage(withStock(s.doc), s.bodies);
  assert.deepEqual([Object.keys(p)[0], p.banner, p.notForProduction], ['banner', NOT_FOR_PRODUCTION, true]);
  assert.deepEqual(p.tool, { kind: 'flat', diameter: 6, cornerRadius: 0, fluteLength: 18, shankDiameter: 6, basis: { diameter: 'estimate', shape: 'estimate' } });
  assert.equal(p.setups.length, 1);
  const s0 = p.setups[0];
  assert.deepEqual([s0.setup, s0.frame, s0.axis], ['+Z', [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], [0, 0, 1]]);
  assert.ok('kind' in p.stock && p.stock.kind === 'box', JSON.stringify(p.stock));
  assert.ok(Math.abs(s0.safeZ.value - (p.stock.max[2] + 5)) < 1e-9, `safe ${s0.safeZ.value} over the stock's top ${p.stock.max[2]}`);
  linkingHolds(s0);
  const feedZ = [...new Set(s0.moves.filter(m => m.kind === 'feed').map(m => +m.a[2].toFixed(9)))].sort((a, b) => b - a);
  assert.deepEqual(feedZ, [17, 14, 12]);
  assert.ok(s0.moves.some(m => m.kind === 'ramp') || s0.moves.some(m => m.kind === 'plunge'), 'it enters the cut');
  assert.deepEqual(s0.passes.map(x => [x.level, x.loop]).slice(0, 6), [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [6, 0]]);
  assert.equal(s0.moves.at(-1)!.b[2], s0.safeZ.value, 'it ends up at the safe height');
  // (No stock loaded: the refusal, the safe height over the part's box.)
  const none = camPackage(s.doc, s.bodies);
  assert.ok('refused' in none.stock && none.stock.refused.code === 'STOCK_NONE_LOADED', JSON.stringify(none.stock));
  linkingHolds(none.setups[0]);
});

test('B: the swept volume of the feed moves is the pocket\'s 50 · 30 · 8 = 12000 mm³, less at most the four corners a flat Ø6 tool cannot reach (4(1 − π/4)·3²·8)', async () => {
  const s = await build(POCKET), p = camPackage(withStock(s.doc), s.bodies), s0 = p.setups[0], R = p.tool.diameter / 2;
  // (Each level's cut: the cells within R of a feed or a ramp at it, times its thickness from the level above.)
  const levels = [[17, 3], [14, 3], [12, 2]] as const, cell = 0.05, feeds = s0.moves.filter(m => m.kind === 'feed');
  // (The pocket's plan from the outermost loop grown by the tool's radius: where the box command put it.)
  const x0 = Math.min(...feeds.map(m => m.a[0])) - R, x1 = Math.max(...feeds.map(m => m.a[0])) + R, y0 = Math.min(...feeds.map(m => m.a[1])) - R, y1 = Math.max(...feeds.map(m => m.a[1])) + R;
  assert.ok(Math.abs(x1 - x0 - 50) < 1e-6 && Math.abs(y1 - y0 - 30) < 1e-6, `the pocket ${x1 - x0} × ${y1 - y0}`);
  let volume = 0;
  for (const [z, thick] of levels) {
    const moves = s0.moves.filter(m => (m.kind === 'feed' && Math.abs(m.a[2] - z) < 1e-9 && Math.abs(m.b[2] - z) < 1e-9) || (m.kind === 'ramp' && Math.min(m.a[2], m.b[2]) >= z - 1e-9 && Math.max(m.a[2], m.b[2]) <= z + thick + 1e-9));
    let cut = 0;
    for (let x = x0 + cell / 2; x < x1; x += cell) for (let y = y0 + cell / 2; y < y1; y += cell) { for (const m of moves) if (segDist2(x, y, m) <= R * R) { cut++; break; } }
    volume += cut * cell * cell * thick;
  }
  const corners = 4 * (1 - Math.PI / 4) * R * R * 8, raster = 2 * (50 + 30) * cell * 8;
  assert.ok(volume <= 12000 + raster && volume >= 12000 - corners - raster, `${volume} of 12000 (corners ${corners}, raster ${raster})`);
});

test('B: CNC8\'s holes — each a plunge from the safe height to its bottom and a retract, in its own setup\'s frame (−Z turned over); O161: a through hole drilled once, by the first setup that reaches it', async () => {
  // (A through hole, a blind one from the top, and a blind one from the bottom: the bottom's needs the −Z setup.)
  // (Holes of the tool's Ø4, so each is a plunge (O161, F3: a wider one is milled, below).)
  const s = await build([cmd('box', { w: 60, d: 40, h: 20, x: 0, y: 0, z: 0 }), cmd('hole', { d: 4, x: 15, y: 20 }, { faces: ['n1.top'] }), cmd('hole', { type: 'blind', d: 4, depth: 10, x: 45, y: 20 }, { faces: ['n1.top'] }), cmd('hole', { type: 'blind', d: 4, depth: 6, x: 30, y: 10 }, { faces: ['n1.bottom'] })]);
  const p = camPackage(s.doc, s.bodies, { toolDiameter: 4 });
  assert.deepEqual(p.setups.map(x => x.setup), ['+Z', '−Z']);
  for (const x of p.setups) {
    linkingHolds(x);
    for (const d of x.passes.filter(q => q.kind === 'drill')) {
      const [plunge, retract] = x.moves.slice(d.to - 2, d.to);
      assert.deepEqual([plunge.kind, retract.kind], ['plunge', 'retract']);
      assert.ok(plunge.b[2] < plunge.a[2] && retract.b[2] === x.safeZ.value);
    }
  }
  // (Each hole exactly once over the whole package.)
  const drilled = p.setups.flatMap(x => x.passes.filter(q => q.kind === 'drill').map(q => q.feature)).sort();
  assert.deepEqual(drilled, [...new Set(drilled)]); assert.equal(drilled.length, 3);
  const top = p.setups.find(x => x.setup === '+Z')!, depths = top.passes.filter(q => q.kind === 'drill').map(d => +(top.moves[d.to - 2].b[2]).toFixed(9)).sort((a, b) => a - b);
  assert.deepEqual(depths, [0, 10], 'the through hole to z 0, the blind one to z 10, both from the top');
  const under = p.setups.find(x => x.setup === '−Z')!;
  assert.deepEqual(under.axis, [0, 0, -1]);
  assert.equal(under.passes.filter(q => q.kind === 'drill').length, 1, 'only the bottom\'s blind hole');
  assert.ok(under.moves.every(m => m.kind !== 'plunge' || m.b[2] <= m.a[2]), 'down along its own axis');
  const through = top.passes.find(q => q.kind === 'drill' && Math.abs(top.moves[q.to - 2].b[2]) < 1e-9)!.feature;
  assert.deepEqual(under.notes, [`${through}: drilled in the +Z setup, not again here`]);
  assert.equal(top.notes, undefined);
});

// (O157: an absolute oracle. Each pocket's feeds, taken back to world coordinates through the setup's frame (a rotation:
// its transpose), lie in the pocket inset by the tool's radius R = 3 — not the feeds' own bounds, which hid a program
// shifted by the floor plane's in-plane origin — and at the levels measured down from the face the pocket opens on.)
const worldOf = (s: SetupProgram, m: readonly number[]) => { const f = s.frame; return [f[0] * m[0] + f[1] * m[1] + f[2] * m[2], f[4] * m[0] + f[5] * m[1] + f[6] * m[2], f[8] * m[0] + f[9] * m[1] + f[10] * m[2]]; };
function feedBounds(s: SetupProgram) {
  const pts = s.moves.filter(m => m.kind === 'feed').flatMap(m => [worldOf(s, m.a), worldOf(s, m.b)]);
  return [0, 1, 2].map(k => [Math.min(...pts.map(p => p[k])), Math.max(...pts.map(p => p[k]))].map(v => +v.toFixed(6)));
}
test('O157 the pocket where it is: +Z, −Z and side setups — the feeds in world coordinates inside the pocket inset by R, at its levels', async () => {
  // (+Z: CNC8's pocket at x 35–85, y 25–55, floor z 12 under the top z 20.)
  let s = await build(POCKET), p = camPackage(withStock(s.doc), s.bodies);
  assert.deepEqual(p.setups.map(x => x.setup), ['+Z']);
  assert.deepEqual(feedBounds(p.setups[0]), [[38, 82], [28, 52], [12, 17]]);
  // (−Z: the same pocket opening on the bottom, x 35–85, y 25–55, floor z 8 over the bottom z 0.)
  s = await build([cmd('box', { w: 120, d: 80, h: 20, x: 0, y: 0, z: 0 }), cmd('box', { w: 50, d: 30, h: 8, x: 35, y: 25, z: 0 }), ['run_command', { command: 'difference', values: {}, bodies: ['b1', 'b3'] }]]);
  p = camPackage(withStock(s.doc), s.bodies);
  const down = p.setups.find(x => x.setup === '−Z'); assert.ok(down, JSON.stringify(p.setups.map(x => x.setup)));
  assert.deepEqual(feedBounds(down), [[38, 82], [28, 52], [3, 8]]);
  // (+X: a side pocket into the face x 120, y 25–55, z 4–16, floor x 112.)
  s = await build([cmd('box', { w: 120, d: 80, h: 20, x: 0, y: 0, z: 0 }), cmd('box', { w: 8, d: 30, h: 12, x: 112, y: 25, z: 4 }), ['run_command', { command: 'difference', values: {}, bodies: ['b1', 'b3'] }]]);
  p = camPackage(withStock(s.doc), s.bodies);
  const side = p.setups.find(x => x.setup === '+X'); assert.ok(side, JSON.stringify(p.setups.map(x => x.setup)));
  assert.deepEqual(feedBounds(side), [[112, 117], [28, 52], [7, 13]]);
});

test('O161, F3: a Ø47 through bore with the Ø6 tool — never a plunge: one circular pocket from +Z, its levels down through 14, every cut inside the bore by R; the Ø6 holes beside it still plunged', async () => {
  const s = await build([cmd('box', { w: 200, d: 300, h: 14, x: 0, y: 0, z: 0 }), cmd('hole', { d: 47, x: 100, y: 150 }, { faces: ['n1.top'] }), cmd('hole', { d: 6, x: 20, y: 20 }, { faces: ['n1.top'] })]);
  const p = camPackage(s.doc, s.bodies), R = p.tool.diameter / 2;
  assert.deepEqual([p.tool.diameter, p.setups.map(x => x.setup)], [6, ['+Z']]);
  const top = p.setups[0], bore = top.passes.filter(q => q.kind === 'pocket'), drills = top.passes.filter(q => q.kind === 'drill');
  assert.equal(new Set(bore.map(q => q.feature)).size, 1); assert.equal(drills.length, 1, 'the Ø6 hole, the tool\'s size, a plunge');
  assert.ok(!drills.some(q => q.feature === bore[0].feature), 'the bore is not drilled');
  assert.deepEqual([...new Set(bore.map(q => q.level))], [3, 6, 9, 12, 14]);
  // (In world coordinates (the +Z frame is the identity): every feed of the bore within 23.5 − R of its axis, the
  // outermost at that radius to the polygon's sagitta, the deepest at z 0.)
  const feeds = bore.flatMap(q => top.moves.slice(q.from, q.to)).filter(m => m.kind === 'feed');
  const radius = (m: { b: number[] }) => Math.hypot(m.b[0] - 100, m.b[1] - 150);
  assert.ok(Math.max(...feeds.map(radius)) <= 23.5 - R + 1e-6 && Math.max(...feeds.map(radius)) >= 23.5 - R - 2e-3, String(Math.max(...feeds.map(radius))));
  assert.deepEqual([Math.min(...feeds.map(m => m.b[2])), Math.max(...feeds.map(m => m.b[2]))].map(v => +v.toFixed(6)), [0, 11]);
  linkingHolds(top);
});

test('O166: a hole narrower than the tool is refused by name, CAM_TOOL_TOO_LARGE — never an overcut drill point; the rest of the program kept', async () => {
  const s = await build([cmd('box', { w: 60, d: 40, h: 20, x: 0, y: 0, z: 0 }), cmd('hole', { type: 'blind', d: 5, depth: 10, x: 15, y: 20 }, { faces: ['n1.top'] }), cmd('hole', { type: 'blind', d: 6, depth: 10, x: 45, y: 20 }, { faces: ['n1.top'] })]);
  const p = camPackage(s.doc, s.bodies), top = p.setups.find(x => x.setup === '+Z')!;
  assert.equal(p.tool.diameter, 6);
  assert.equal(p.refusals?.length, 1);
  const [r] = p.refusals!, drilled = top.passes.filter(q => q.kind === 'drill').map(q => q.feature);
  assert.deepEqual([r.code, r.setup, r.message], ['CAM_TOOL_TOO_LARGE', '+Z', 'Ø5 hole is narrower than the Ø6 tool: a plunge would overcut it']);
  assert.equal(drilled.length, 1, 'the Ø6 hole, the tool\'s size, still drilled'); assert.ok(!drilled.includes(r.feature));
  assert.deepEqual(top.notes, [`${r.feature}: [CAM_TOOL_TOO_LARGE] ${r.message}`]);
  linkingHolds(top);
  // (Without such a hole, no refusals key at all: cam-package-v1 readers see what they saw.)
  assert.equal('refusals' in camPackage(s.doc, s.bodies, { toolDiameter: 5 }), false);
});
