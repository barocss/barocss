import test from 'node:test';
import assert from 'node:assert/strict';
import { commands } from '../src/app/commands';
import { profilePath } from '../src/app/sheetCommands';
import { evaluateDoc, evaluatePart, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, withNode, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { editFields } from '../src/app/editFields';

// R12.1 (D116): sheet metal in the studio — a plate from a sketch and a bent profile from the palette, their rules and
// bends in the body's panel (the K-factor's prefill said to be an estimate), and the agent's commands and raw nodes.
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, !r.ok ? r.error.detail : ''); return (r as { bodies: BodyResult[] }).bodies; };
const none = { faces: [], edges: [], bodies: [] };
const noId = (n: object) => { const o = { ...n } as Record<string, unknown>; delete o.id; return o; };
/** The middle line of a path's sheet (the textbook virtual-sharp relations, as in the kernel's tests). */
function middleLength(path: [number, number][], side: 'left' | 'right', T: number, R: number): number {
  let L = 0;
  for (let i = 0; i + 1 < path.length; i++) L += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
  for (let k = 1; k + 1 < path.length; k++) {
    const a = [path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]], b = [path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]];
    const th = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]), outer = Math.sign(th) === (side === 'left' ? 1 : -1);
    L += -2 * (outer ? R + T : R) * Math.tan(Math.abs(th) / 2) + Math.abs(th) * (R + T / 2);
  }
  return L;
}

test('D116 Sheet profile: an L, a U, a Z and a hat standing on XZ, the textbook volume; the rules and bends in its notes, the K prefill flagged an estimate; its label and fields; it saves', () => {
  const cmd = commands.find(c => c.id === 'sheet-profile')!, ctx = { doc: emptyDoc(), bodies: [], selection: none } as never, d = cmd.defaults!(ctx);
  assert.deepEqual({ t: d.t, r: d.r, k: d.k }, { t: 1.5, r: 1.5, k: 0.5 });
  for (const shape of ['l', 'u', 'z', 'hat']) {
    const doc = cmd.build!(ctx, { ...d, shape, x: 0 }), node = doc.nodes[0], [body] = bodiesOf(doc), { path, side } = profilePath(shape, 40, 30, 12, 90);
    assert.equal(node.kind, 'sheet-contour');
    assert.ok(Math.abs(body.volumeMM3! / (30 * 1.5 * middleLength(path, side, 1.5, 1.5)) - 1) < 1e-12, shape);
    // Standing on XZ from y 0 to the width.
    assert.ok(Math.abs(body.mesh.bounds.min[1]) < 1e-9 && Math.abs(body.mesh.bounds.max[1] - 30) < 1e-9, shape);
    const notes = body.notes!.map(n => n.text), bends = path.length - 2;
    assert.equal(notes[0], 'Sheet metal: 1.5 mm thick, bends of inner radius 1.5 mm, K-factor 0.5');
    assert.ok(body.notes![1].warning && /K 0\.5 is an estimate/.test(notes[1]));
    // (Its rules, the estimate, a line a bend and its flat pattern, R12.2.)
    assert.equal(notes.length, 3 + bends);
    assert.match(notes.at(-1)!, /^Flat pattern ([\d.]+ × 30|30 × [\d.]+) mm, \d bends?$/);
    assert.match(notes[2], /^bend1: 90°, allowance 3\.534 mm, setback 3 mm, deduction 2\.466 mm$/);
    assert.equal(featureLabel(node, 0, doc.nodes), `Sheet profile T1.5 · ${bends} bend${bends > 1 ? 's' : ''}`);
  }
  // A K of the shop's: no estimate note. Its faces by role.
  const doc = cmd.build!(ctx, { ...d, k: 0.42, x: 0 }), [body] = bodiesOf(doc);
  assert.equal(body.notes!.length, 3);
  assert.deepEqual([...new Set(body.mesh.faces.map(f => f.name.replace(/^n\d+\./, '')))].sort(), ['back', 'bend1.inner', 'bend1.outer', 'end', 'front', 'leg0.a', 'leg0.b', 'leg1.a', 'leg1.b', 'start']);
  // An L at 120°; a K outside 0–1 refused.
  assert.equal(bodiesOf(cmd.build!(ctx, { ...d, angle: 120, x: 0 })).length, 1);
  assert.throws(() => cmd.build!(ctx, { ...d, k: 1.5 }), /K-factor lies from 0/);
  // The feature editor: thickness, radius, K and width.
  assert.deepEqual(editFields(doc.nodes, 0).map(f => f.key), ['t', 'r', 'k', 'w']);
  const read = readStudioDoc(JSON.stringify(doc)); assert.ok('doc' in read, JSON.stringify(read)); assert.equal(read.doc.nodes[0].kind, 'sheet-contour');
});

test('D116 Sheet plate: from a finished sketch, T thick either way; offered only with a sketch', () => {
  const cmd = commands.find(c => c.id === 'sheet-plate')!;
  assert.equal(cmd.available({ doc: emptyDoc(), bodies: [], selection: none } as never).ok, false);
  const sketch = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 50] }), ctx = { doc: sketch, bodies: [], selection: none } as never;
  assert.equal(cmd.available(ctx).ok, true);
  for (const side of ['up', 'down']) {
    const doc = cmd.build!(ctx, { ...cmd.defaults!(ctx), side }), [body] = bodiesOf(doc);
    assert.deepEqual(noId(doc.nodes[1]), { kind: 'sheet-base', sketch: 0, thickness: 1.5, bendRadius: 1.5, kFactor: 0.5, ...(side === 'down' ? { reverse: true } : {}) });
    assert.ok(Math.abs(body.volumeMM3! - 80 * 50 * 1.5) < 1e-9 && Math.abs(body.centroid![2] - (side === 'down' ? -0.75 : 0.75)) < 1e-12);
    assert.equal(featureLabel(doc.nodes[1], 1, doc.nodes), 'Sheet plate T1.5');
  }
});

test('D116 the agent: run_command sheet-profile, and a raw sheet-contour node (its own path and rules), checked and built', async () => {
  const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
  const state: ChatState = { doc: emptyDoc(), bodies: [] };
  const r = await dispatchTool(state, 'run_command', { command: 'sheet-profile', values: { shape: 'u', a: 60, b: 25, w: 40, t: 2, r: 2, k: 0.44, x: 0, y: 0, z: 0 } }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.equal(r.state.doc.nodes[0].kind, 'sheet-contour');
  assert.ok(r.state.bodies[0].notes?.some(n => /^Sheet metal: 2 mm thick/.test(n.text)), JSON.stringify(r.state.bodies[0].notes));
  const path: [number, number][] = [[0, 0], [30, 0], [30, 25]], node = { kind: 'sheet-contour', path, side: 'left', width: 40, thickness: 2, bendRadius: 3, kFactor: 0.4 };
  const a = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [node] }, evaluate);
  assert.ok(!a.isError, a.content);
  assert.ok(Math.abs(a.state.bodies[0].volumeMM3! - 40 * 2 * middleLength(path, 'left', 2, 3)) < 1e-9);
  // A path of one point, and a leg too short for its bend: refused, nothing added.
  const bad = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [{ ...node, path: [[0, 0]] }] }, evaluate);
  assert.ok(bad.isError && /2 to 64 \[x, y\] points/.test(bad.content), bad.content);
  const short = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [{ ...node, path: [[0, 0], [4, 0], [4, 20]] }] }, evaluate);
  assert.ok(short.isError && /BEND_DOES_NOT_FIT/.test(short.content), short.content);
});

test('D117 a sheet\'s flat pattern on its body: a channel with a hole cut by difference unfolds (the textbook length, its bends) and its DXF writes; a slanted hole says why it has none', async () => {
  const { flatPatternDxf, writeDxf } = await import('@barocss/cad');
  const T = 1.5, R = 2, K = 0.44, W = 25, th = Math.PI / 2, BD = 2 * (R + T) * Math.tan(th / 2) - th * (R + K * T), L = 100 - 2 * BD;
  let doc = withNode(emptyDoc(), { kind: 'sheet-contour', path: [[0, 30], [0, 0], [40, 0], [40, 30]], side: 'left', width: W, thickness: T, bendRadius: R, kFactor: K });
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [20, -W / 2], radius: 4, plane: { origin: [0, -1, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] } });
  doc = withNode(doc, { kind: 'extrude', sketch: 1, height: T + 2 });
  doc = withNode(doc, { kind: 'difference', parent: { node: 0, side: 'solid' }, tool: { node: 2, side: 'solid' } });
  const [body] = bodiesOf(doc), flat = body.flat!;
  assert.ok(Math.abs(flat.box.max[0] - L) < 1e-9 && Math.abs(flat.box.max[1] - W) < 1e-9, JSON.stringify(flat.box));
  assert.equal(flat.bends.length, 2); assert.ok(flat.bends.every(b => b.direction === 'down'));
  assert.ok(body.notes!.some(n => n.text === `Flat pattern ${+L.toFixed(3)} × 25 mm, 2 bends`), JSON.stringify(body.notes));
  const text = writeDxf(flatPatternDxf(flat), {}).text;
  assert.ok(/\nBEND_DOWN\r?\n/.test(text) && (text.match(/\nCIRCLE\r?\n/g) ?? []).length === 1);
  // A hole drilled off the sheet's normal: no flat, the reason in its notes.
  let tilted = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 50] });
  tilted = withNode(tilted, { kind: 'sheet-base', sketch: 0, thickness: 2, bendRadius: 2, kFactor: 0.44 });
  tilted = withNode(tilted, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4, plane: { origin: [40, 25, -5], normal: [0.3, 0, 1], xAxis: [1, 0, -0.3] } });
  tilted = withNode(tilted, { kind: 'extrude', sketch: 2, height: 12 });
  tilted = withNode(tilted, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } });
  const [t] = bodiesOf(tilted);
  assert.equal(t.flat, undefined);
  assert.match(t.flatRefused!, /^\[NON_NORMAL_CUT\]/);
  assert.ok(t.notes!.some(n => n.warning && /^No flat pattern: \[NON_NORMAL_CUT\]/.test(n.text)), JSON.stringify(t.notes));
});
