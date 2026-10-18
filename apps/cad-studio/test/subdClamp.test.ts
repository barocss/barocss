import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkBrep, subdBrep, validateCage } from '@barocss/cad';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { commitDrag, runOp, startSession, type CageSession } from '../src/subd/cageEdit';

// D84 (R8.3): the owner's acceptance part, a SubD pipe clamp (handover/notes/acceptance/subd-pipe-clamp.png), built
// through the agent's cage tools as an agent would: each pick found by subd_select (or read off the cage), each change
// one tool call. The calls are kept (test/fixtures/subd-pipe-clamp.calls.json: the browser flow replays them through
// the real chat and tool servers) and so is the cage they make (the kernel's conformance case r8/subd-pipe-clamp,
// whose SubD metrics, mass, STEP round trip and tessellation the kernel checks). UPDATE_CLAMP=1 writes both again.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
type Subd = Extract<ModelNode, { kind: 'subd' }>;
type V3 = [number, number, number];
const CALLS = join(process.cwd(), 'test/fixtures/subd-pipe-clamp.calls.json');
const CASE = join(process.cwd(), '../../packages/barocss-cad/conformance/r8/subd-pipe-clamp.json');

/** The clamp's sizes: a 20/17 mm tube 40 long, 24 quads round and 7 along; a lug of 4 levels over rows 1–5 of column 0. */
const RO = 20, RI = 17, H = 40, NU = 24, NH = 7, ROW = H / NH, LEVELS = [4, ROW, ROW, ROW], HOLD = 0.6, HOLE = 4.2, RING = 5.2, FUNNEL = 0.6;

async function buildClamp(): Promise<{ calls: { tool: string; args: Record<string, unknown> }[]; state: ChatState }> {
  const calls: { tool: string; args: Record<string, unknown> }[] = [];
  let state: ChatState = { doc: emptyDoc(), bodies: [] };
  const call = async (tool: string, args: Record<string, unknown>) => {
    const r = await dispatchTool(state, tool, args, evaluate);
    assert.ok(!r.isError, `${tool} ${JSON.stringify(args).slice(0, 200)}: ${r.content}`);
    calls.push({ tool, args }); state = r.state;
    return JSON.parse(r.content) as Record<string, any>;
  };
  const ask = async (args: Record<string, unknown>) => {
    const r = await dispatchTool(state, 'subd_select', { index: 0, ...args }, evaluate);
    assert.ok(!r.isError, r.content); return JSON.parse(r.content) as Record<string, any>;
  };
  const cage = () => (state.doc.nodes[0] as Subd).cage, at = (v: number): V3 => { const P = cage().positions; return [P[3 * v], P[3 * v + 1], P[3 * v + 2]]; };
  /** A loop through the ring of an edge of the first face found that crosses `axis` = `value`, placed there. */
  const loopAt = async (faces: Record<string, unknown>, axis: number, value: number) => {
    for (const { face } of (await ask({ what: 'faces', ...faces })).faces as { face: number }[]) {
      const F = cage().faces[face];
      for (let i = 0; i < F.length; i++) {
        const a = F[i], b = F[(i + 1) % F.length], pa = at(a)[axis], pb = at(b)[axis];
        if ((pa - value) * (pb - value) < 0) return call('subd_insert_loop', { index: 0, edge: [a, b], t: (value - pa) / (pb - pa) });
      }
    }
    throw new Error(`no edge crosses ${axis} = ${value}`);
  };
  /** Vertices in a box, those with the same x and z moved together by one delta each (both sides of the lug). */
  const moveTo = async (box: { min: V3; max: V3 }, target: (p: V3) => V3) => {
    const groups = new Map<string, number[]>();
    for (const { vertex, at: p } of (await ask({ what: 'vertices', box })).vertices as { vertex: number; at: V3 }[]) {
      const key = `${p[0].toFixed(6)},${p[2].toFixed(6)}`; groups.set(key, [...(groups.get(key) ?? []), vertex]);
    }
    for (const vs of groups.values()) {
      const p = at(vs[0]), q = target(p), d = [q[0] - p[0], 0, q[2] - p[2]].map(x => Math.round(x * 1e9) / 1e9);
      if (Math.hypot(...d) > 1e-9) await call('subd_move', { index: 0, vertices: vs, delta: d });
    }
    return groups.size;
  };

  await call('run_command', { command: 'subd-tube', values: { r: RO, ri: RI, h: H, nu: NU, nh: NH, x: 0, y: 0, z: 0 } });
  const cu = (4 + 2 * Math.cos(2 * Math.PI / NU)) / 6, half = (RO / cu) * Math.sin(Math.PI / NU), x0 = (RO / cu) * Math.cos(Math.PI / NU);
  const col0 = (lo: V3, hi: V3) => ({ box: { min: [0, -1, lo[2]], max: [hi[0], 1, hi[2]] } });
  // 1. Holding loops at both rims: on each wall near each end, on each rim near both corners.
  await loopAt({ normal: [1, 0, 0], within_deg: 5, ...col0([0, 0, 0], [99, 0, ROW]) }, 2, HOLD);
  await loopAt({ normal: [1, 0, 0], within_deg: 5, ...col0([0, 0, H - ROW], [99, 0, H]) }, 2, H - HOLD);
  await loopAt({ normal: [-1, 0, 0], within_deg: 5, ...col0([0, 0, 0], [99, 0, ROW]) }, 2, HOLD);
  await loopAt({ normal: [-1, 0, 0], within_deg: 5, ...col0([0, 0, H - ROW], [99, 0, H]) }, 2, H - HOLD);
  for (const n of [[0, 0, 1], [0, 0, -1]]) {
    await loopAt({ normal: n, within_deg: 5, ...col0([0, 0, -1], [99, 0, H + 1]) }, 0, RO / cu - HOLD);
    await loopAt({ normal: n, within_deg: 5, ...col0([0, 0, -1], [99, 0, H + 1]) }, 0, RI / cu + HOLD);
  }
  // 2. The lug: column 0's outer faces over rows 1–5 extruded out along +X, level by level; the first row stops a
  // level short (the step).
  const strip = (await ask({ what: 'faces', normal: [1, 0, 0], within_deg: 5, ...col0([0, 0, ROW], [99, 0, 6 * ROW]) })).faces.map((f: { face: number }) => f.face);
  assert.equal(strip.length, 5);
  let top: number[] = strip;
  // (Their normal is +X: the column is centred on it.)
  for (const d of LEVELS.slice(0, 3)) top = (await call('subd_extrude', { index: 0, faces: top, offset: [d, 0, 0] })).cage.new.faces;
  const xl = [x0, x0 + LEVELS[0], x0 + LEVELS[0] + LEVELS[1], x0 + LEVELS[0] + LEVELS[1] + LEVELS[2]], x4 = xl[3] + LEVELS[3];
  const upper = (await ask({ what: 'faces', normal: [1, 0, 0], within_deg: 5, box: { min: [xl[3] - 0.1, -1, 2 * ROW], max: [xl[3] + 0.1, 1, 6 * ROW] } })).faces.map((f: { face: number }) => f.face);
  assert.equal(upper.length, 4);
  await call('subd_extrude', { index: 0, faces: upper, offset: [LEVELS[3], 0, 0] });
  // 3. The hole: the 2 × 2 block of side faces at levels 2–3 × rows 3–4 deleted on both sides; each mouth moved
  // onto a circle, then pulled into the lug a little (a short funnel: the mouth's holding ring) and its new edges moved
  // onto the hole's circle; the two mouths bridged. (Each step a body the kernel builds: an extrusion of 0 to drag
  // afterwards, as the editor's gizmo does, would leave coincident vertices, which it refuses.)
  const xc = xl[2], zc = 4 * ROW;
  const block = await Promise.all([1, -1].map(async s => (await ask({ what: 'faces', normal: [0, s, 0], within_deg: 5, box: { min: [xl[1], -9, 3 * ROW], max: [xl[3], 9, 5 * ROW] } })).faces.map((f: { face: number }) => f.face)));
  assert.deepEqual(block.map(b => b.length), [4, 4]);
  await call('subd_delete', { index: 0, faces: block.flat() });
  const onCircle = (r: number) => (p: V3): V3 => { const a = Math.atan2(p[2] - zc, p[0] - xc); return [xc + r * Math.cos(a), p[1], zc + r * Math.sin(a)]; };
  const hole = { min: [xl[1] - 0.1, -9, 3 * ROW - 0.1] as V3, max: [xl[3] + 0.1, 9, 5 * ROW + 0.1] as V3 };
  assert.equal(await moveTo(hole, onCircle(RING)), 8);
  for (const s of [1, -1]) {
    const open = (await ask({ what: 'boundary', box: { min: [-99, s > 0 ? 0 : -9, -99], max: [99, s > 0 ? 9 : 0, 99] } })).open_edges;
    assert.equal(open.length, 8);
    await call('subd_extrude', { index: 0, edges: open, offset: [0, -s * FUNNEL, 0] });
  }
  const inner = { min: [xl[1] - 0.1, -half + FUNNEL / 2, 3 * ROW - 0.1] as V3, max: [xl[3] + 0.1, half - FUNNEL / 2, 5 * ROW + 0.1] as V3 };
  assert.equal(await moveTo(inner, onCircle(HOLE)), 8);
  const mouths = (await ask({ what: 'boundary' })).open_edges;
  assert.equal(mouths.length, 16);
  await call('subd_bridge', { index: 0, edges: mouths });
  // Holding loops in the hole near each mouth (its edges run along Y), and along the lug's sides (its thickness edges,
  // along Y; they run on round the tube's column 0).
  const tunnel = { box: { min: [xc - HOLE - 0.1, -half, zc - HOLE - 0.1] as V3, max: [xc + HOLE + 0.1, half, zc + HOLE + 0.1] as V3 } };
  await loopAt({ ...tunnel }, 1, half - FUNNEL - 0.5);
  await loopAt({ ...tunnel }, 1, -half + FUNNEL + 0.5);
  const lugTop = { normal: [1, 0, 0], within_deg: 5, box: { min: [xl[3] + 0.1, -9, 0], max: [99, 9, H] } };
  await loopAt(lugTop, 1, half - HOLD);
  await loopAt(lugTop, 1, -half + HOLD);
  // 4. The lug's top an arc round the hole's centre (radius two rows) through its middle, its right end turned down
  // the side; its left end down a little to the step.
  const Rt = 2 * ROW, arc = (deg: number) => (p: V3): V3 => [xc + Rt * Math.cos(deg * Math.PI / 180), p[1], zc + Rt * Math.sin(deg * Math.PI / 180)];
  const atXZ = (x: number, z: number) => ({ min: [x - 0.05, -9, z - 0.05] as V3, max: [x + 0.05, 9, z + 0.05] as V3 });
  await moveTo(atXZ(x4, 2 * ROW), p => [xc + 7.5, p[1], 2 * ROW + 1]);
  await moveTo(atXZ(x4, 3 * ROW), arc(-30));
  await moveTo(atXZ(x4, 5 * ROW), arc(30));
  await moveTo(atXZ(x4, 6 * ROW), arc(55));
  await moveTo(atXZ(xl[3], 6 * ROW), arc(75));
  return { calls, state };
}

let built: Promise<{ calls: { tool: string; args: Record<string, unknown> }[]; state: ChatState }> | null = null;
const clamp = () => built ??= buildClamp();

test('D84 the pipe clamp built through the agent\'s cage tools: a tube with holding loops, a lug extruded with a step, a hole bridged through it with holding loops, the top an arc; one closed body; the calls and the cage as kept', async () => {
  const { calls, state } = await clamp(), node = state.doc.nodes[0] as Subd;
  assert.equal(state.bodies.length, 1);
  const v = validateCage(node.cage);
  assert.equal(v.valid, true); assert.equal(v.boundaryEdges.length, 0);
  const b = subdBrep(node.cage, { id: 'clamp' }), r = checkBrep(b);
  assert.equal(r.valid, true, r.issues[0]);
  assert.deepEqual(r.topology.map(t => ({ shells: t.shells, genus: t.genus })), [{ shells: 1, genus: 2 }]);
  const kept = JSON.parse(readFileSync(CASE, 'utf8'));
  if (process.env.UPDATE_CLAMP) {
    writeFileSync(CALLS, JSON.stringify({ about: 'D84: the SubD pipe clamp as agent cage-tool calls (test/subdClamp.test.ts makes them; the browser flow replays them).', calls }, null, 1) + '\n');
    kept.input.partDocument.features[0].cage = node.cage;
    writeFileSync(CASE, JSON.stringify(kept, null, 2) + '\n');
  }
  assert.deepEqual(JSON.parse(readFileSync(CALLS, 'utf8')).calls, JSON.parse(JSON.stringify(calls)), 'the calls as kept (UPDATE_CLAMP=1 writes them)');
  assert.deepEqual(kept.input.partDocument.features[0].cage, JSON.parse(JSON.stringify(node.cage)), 'the cage as the conformance case keeps it');
  const counts = calls.reduce<Record<string, number>>((m, c) => ({ ...m, [c.tool]: (m[c.tool] ?? 0) + 1 }), {});
  assert.deepEqual(counts, { run_command: 1, subd_insert_loop: 12, subd_extrude: 6, subd_delete: 1, subd_move: 21, subd_bridge: 1 });
});

test('D84 the same clamp by the editor\'s own steps (what the cage editor runs for a person\'s picks and drags): the agent\'s cage, step for step', async () => {
  const { calls, state } = await clamp();
  let s: CageSession | null = null;
  for (const { tool, args } of calls) {
    if (tool === 'run_command') { const r = await dispatchTool({ doc: emptyDoc(), bodies: [] }, tool, args, evaluate); s = startSession(0, (r.state.doc.nodes[0] as Subd).cage); continue; }
    const sel = { vertices: (args.vertices as number[]) ?? [], faces: (args.faces as number[]) ?? [], edges: [...(args.edge ? [args.edge as [number, number]] : []), ...((args.edges as [number, number][]) ?? [])] };
    const at: CageSession = { ...s!, sel };
    if (tool === 'subd_move') s = commitDrag(at, args.delta as number[], false);
    else if (tool === 'subd_extrude') s = commitDrag(at, args.offset as number[], true);
    else s = runOp(at, tool === 'subd_insert_loop' ? 'insert-loop' : tool === 'subd_bridge' ? 'bridge' : 'delete', undefined, (args.t as number | undefined) ?? 0.5);
  }
  assert.deepEqual(s!.cage, (state.doc.nodes[0] as Subd).cage);
});
