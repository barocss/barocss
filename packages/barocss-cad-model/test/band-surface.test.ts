import test from 'node:test';
import assert from 'node:assert/strict';
import { bandSurfaceCommand, bandPicksOf, bandSurfaceEditCommand } from '../src/app/bandSurfaceCommand';
import { commandById, type Ctx, type Values } from '../src/app/commands';
import { editCommand } from '../src/app/editCommand';
import { checkNode } from '../src/chat/features';
import { CHAT_COMMANDS } from '../src/chat/part/features';
import { deleteFeature, featureDependents } from '../src/chat/features';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { bandSurfaceNodeProblem, emptyDoc, featureLabel, leafBodies, parentsOf, prefixDoc, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { flattenAssembly } from '../src/engine/flatten';
import { exportStudioStep } from '../src/engine/evaluate';
import { stepOf } from '../src/api/core';
import { readStudioDoc } from '../src/engine/migrate';
import { toPartDocument } from '../src/engine/part';
import { captureSignatures, referencesOf, verifyReferences, type Sig } from '../src/engine/references';
import { rematchNames } from '../src/engine/rematch';

type Band = Extract<ModelNode, { kind: 'band-surface' }>;
const solid = (node: number) => ({ node, side: 'solid' as const });
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
function bodies(doc: StudioDoc): BodyResult[] { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; }
const keyOf = (doc: StudioDoc, node: number) => bodies(prefixDoc(doc, node + 1)).find(b => b.ref?.node === node)!;
const topFace = (b: BodyResult) => b.mesh.faces.filter(f => f.kind === 'plane' && f.normal[2] > 0.99).sort((x, y) => y.centroid[2] - x.centroid[2])[0];
/** The kernel names of the display edges around a body's top face, in mesh order. */
const topEdges = (b: BodyResult) => { const f = topFace(b); return b.mesh.edges.filter(e => e.faces.includes(f.index)); };
const namesOf = (edges: readonly { names: string[] }[]) => [...new Set(edges.flatMap(e => e.names))];

const LOOP: ModelNode = { kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [40, 0] }, { kind: 'line', start: [40, 30] }, { kind: 'line', start: [0, 30] }], sideTags: { outer: ['e0', 'e1', 'e2', 'e3'] } } as ModelNode;

/** Box n1 (side-tagged sketch) with vertical fillets n2, a cylinder n4 above it, and the band n5 between the top loop of n2 and the cylinder's top rim. */
function scenario(height = 10, radius = 3, sides = 4): StudioDoc {
  const nodes: ModelNode[] = [LOOP, { kind: 'extrude', sketch: 0, height }];
  const base = prefixDoc({ ...emptyDoc(), nodes }, 2);
  const corner = (b: BodyResult) => b.mesh.edges.filter(e => e.faces.every(i => /side\[/.test(b.mesh.faces[i].name)));
  const verticals = namesOf(corner(keyOf(base, 1)));
  assert.equal(verticals.length, 4);
  void sides;
  const doc0 = prefixDoc({ ...base, nodes: [...base.nodes, { kind: 'fillet', parent: solid(1), edges: verticals, radius }, { kind: 'sketch', profile: 'circle', center: [20, 15], radius: 10 }, { kind: 'extrude', sketch: 3, height: 10, from: 40 }] }, 5);
  const a = namesOf(topEdges(keyOf(doc0, 2))), b = namesOf(topEdges(keyOf(doc0, 4)));
  const band: ModelNode = { kind: 'band-surface', version: 1, a: { parent: solid(2), edges: a }, b: { parent: solid(4), edges: b } };
  return captureSignatures(withNode(doc0, band), bodies(doc0));
}
const bandOf = (doc: StudioDoc): Band => doc.nodes.find(n => n.kind === 'band-surface') as Band;
const bandBody = (doc: StudioDoc) => bodies(doc).find(b => b.band)!;
const zMin = (b: BodyResult) => b.mesh.bounds.min[2];
/** Distance of the band's mesh points at height z from (cx, cy), for those in the quadrant (x<r, y<r). */
const cornerRadii = (b: BodyResult, z: number, r: number) => {
  const p = b.mesh.positions, out: number[] = [];
  for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 2] - z) < 1e-6 && p[i] < r - 1e-9 && p[i + 1] < r - 1e-9) out.push(Math.hypot(p[i] - r, p[i + 1] - r));
  return out;
};

test('regeneration: the band follows a box height and a fillet radius; its names stay as they were', () => {
  const doc = scenario(), band = bandOf(doc), body = bandBody(doc);
  assert.equal(band.a.edges.length, 8); assert.equal(band.b.edges.length, 2);
  assert.equal(body.band!.closed, true); assert.equal(body.band!.exact, true);
  assert.equal(body.band!.pairs, 10); assert.ok(body.band!.boundaryDeviation <= 1e-6 * 40);
  assert.ok(body.notes!.some(n => /band|patch/i.test(n.text)));
  assert.ok(Math.abs(zMin(body) - 10) < 1e-9);
  // Box height 10 → 14: the band's A boundary is the box's new top (z = 14); names unchanged.
  const taller: StudioDoc = prefixDoc({ ...doc, nodes: doc.nodes.map((n, i) => i === 1 && n.kind === 'extrude' ? { ...n, height: 14 } : n) }, doc.nodes.length);
  const after = bandBody(taller);
  assert.ok(Math.abs(zMin(after) - 14) < 1e-9, `A boundary at z=14, got ${zMin(after)}`);
  assert.deepEqual(bandOf(taller).a.edges, band.a.edges);
  // Fillet 3 → 5: the arc boundary is radius 5.
  const rounder: StudioDoc = prefixDoc({ ...doc, nodes: doc.nodes.map((n, i) => i === 2 && n.kind === 'fillet' ? { ...n, radius: 5 } : n) }, doc.nodes.length);
  const arcs = cornerRadii(bandBody(rounder), 10, 5);
  assert.ok(arcs.length > 4, 'boundary points on the corner arcs');
  for (const d of arcs) assert.ok(Math.abs(d - 5) < 1e-6, `arc point at radius ${d}`);
  assert.deepEqual(bandOf(rounder).b.edges, band.b.edges);
});

test('leafBodies keeps both bodies the band joins; the band is read, never consumed', () => {
  const doc = scenario();
  assert.deepEqual(leafBodies(doc.nodes).map(r => r.node), [2, 4, 5]);
  assert.deepEqual(parentsOf(bandOf(doc)), [2, 4]);
  assert.equal(bodies(doc).length, 3);
  assert.equal(featureLabel(bandOf(doc), 5, doc.nodes), 'Band surface');
});

/** A plain box (side-tagged e0–e3, as `extraSolid` features before it when asked) and a cylinder above, with the band between the box's top loop and the cylinder's top rim. */
function plain(extraSolid = false): { doc: StudioDoc; a: string[]; b: string[]; first: number } {
  const first = extraSolid ? 2 : 0;
  const nodes: ModelNode[] = [
    ...(extraSolid ? [{ kind: 'sketch', profile: 'rectangle', min: [500, 0], max: [510, 10] } as ModelNode, { kind: 'extrude', sketch: 0, height: 5 } as ModelNode] : []),
    LOOP, { kind: 'extrude', sketch: first, height: 10 },
    { kind: 'sketch', profile: 'circle', center: [20, 15], radius: 10 }, { kind: 'extrude', sketch: first + 2, height: 10, from: 40 },
  ];
  const box = prefixDoc({ ...emptyDoc(), nodes }, nodes.length);
  const a = namesOf(topEdges(keyOf(box, first + 1))), b = namesOf(topEdges(keyOf(box, first + 3)));
  const doc = captureSignatures(withNode(box, { kind: 'band-surface', version: 1, a: { parent: solid(first + 1), edges: a }, b: { parent: solid(first + 3), edges: b } }), bodies(box));
  return { doc, a, b, first };
}
const triangle = { ...LOOP, segments: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [40, 0] }, { kind: 'line', start: [40, 30] }], sideTags: { outer: ['e0', 'e1', 'e2'] } } as ModelNode;

test('lost edge: a sketch that drops side e3 refuses with [BAND_EDGE_LOST] naming the edge; opened, the band is held and the rest builds', async () => {
  const { doc: withBand, a, b } = plain();
  assert.ok(a.some(n => n.includes('n1.side[e3]')));
  assert.ok(bodies(withBand).some(x => x.band));
  // The side id e3 renamed e4: that one name is lost, the others stay where they were.
  const retagged: ModelNode = { ...LOOP, sideTags: { outer: ['e0', 'e1', 'e2', 'e4'] } } as ModelNode;
  const r = evaluateDoc(prefixDoc({ ...withBand, nodes: withBand.nodes.map((n, i) => i === 0 ? retagged : n) }, withBand.nodes.length), 1);
  assert.ok(!r.ok);
  // The sketch that drops the side altogether: opened, held.
  const lost: StudioDoc = prefixDoc({ ...withBand, nodes: withBand.nodes.map((n, i) => i === 0 ? triangle : n) }, withBand.nodes.length);
  const lostName = a.find(n => n.includes('n1.side[e3]'))!;
  if (!r.ok) { assert.equal(r.error.code, 'BAND_EDGE_LOST'); assert.match(r.error.detail, /\[BAND_EDGE_LOST\]/); assert.ok(r.error.detail.includes('n1.side[e3]'), r.error.detail); }
  // Opened (verifyReferences, no earlier document): the band is held with its reason, nothing is renamed, the box and cylinder build.
  const v = await verifyReferences(lost, [], evaluate);
  assert.deepEqual(v.changes, [], 'no silent retarget');
  const held = bandOf(v.doc);
  assert.equal(held.suppressed, true); assert.match(held.held!, /^"[^"]+" (is gone|could be .+)$/);
  assert.ok(held.held!.includes('n1.side['));
  assert.deepEqual(held.a.edges, a); assert.deepEqual(held.b.edges, b);
  assert.ok(v.problems.some(p => p.name === lostName));
  const rest = bodies(v.doc);
  assert.equal(rest.length, 2); assert.ok(rest.every(x => !x.band));
});

test('an intact two-body band verifies clean: side B is looked up on B’s body, nothing changes, nothing is held', async () => {
  for (const doc of [scenario(), plain().doc]) {
    // Every name of both sides was signed from its own side's body (a name looked up on the wrong body is never signed, so never checked).
    const band = bandOf(doc);
    for (const name of [...band.a.edges, ...band.b.edges]) assert.ok(band.sigs?.[name], `signature of ${name}`);
    const v = await verifyReferences(doc, bodies(doc), evaluate);
    assert.deepEqual(v.changes, []); assert.deepEqual(v.problems, []);
    assert.equal(bandOf(v.doc).held, undefined); assert.equal(bandOf(v.doc).suppressed, undefined);
  }
});

test('an edit that releases a held band: re-picking its lost side validly clears the hold; flip keeps the sigs of kept names', async () => {
  const { doc, b } = plain();
  const lost: StudioDoc = prefixDoc({ ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? triangle : n) }, doc.nodes.length);
  const held = (await verifyReferences(lost, [], evaluate)).doc;
  assert.equal(bandOf(held).suppressed, true);
  const ctx = context(held, { faces: [], edges: [], bodies: [] }), cmd = editCommand(4, held.nodes)!;
  const boxBody = indexOfBody(ctx, 1), v0 = cmd.defaults!(ctx);
  // The box's current top loop (the triangle's) becomes side A again.
  const topNames = namesOf(topEdges(ctx.bodies[boxBody]));
  const v1 = patch(cmd, ctx, v0, { repick: 'a' });
  const edit = cmd.build!(ctx, { ...v1, a: JSON.stringify({ parent: solid(1), edges: topNames }), repick: 'a' });
  const node = bandOf(edit);
  assert.equal(node.held, undefined); assert.equal(node.suppressed, undefined, 'the hold is released');
  assert.deepEqual(node.a.edges, topNames); assert.deepEqual(node.b.edges, b);
  assert.ok(bodies(edit).some(x => x.band));
  // A sentinel signature on a kept name survives an edit of the flip.
  const kept = Object.keys(bandOf(doc).sigs!)[0], marked: StudioDoc = prefixDoc({ ...doc, nodes: doc.nodes.map(n => n.kind === 'band-surface' ? { ...n, sigs: { ...n.sigs, [kept]: { ...n.sigs![kept], s: n.sigs![kept].s + 0.5 } } } : n) }, doc.nodes.length);
  const c2 = context(marked, { faces: [], edges: [], bodies: [] }), e2 = editCommand(4, marked.nodes)!;
  const flipped = e2.build!(c2, { ...e2.defaults!(c2), flip: 'yes' });
  assert.equal(bandOf(flipped).sigs![kept].s, bandOf(marked).sigs![kept].s);
});

test('suppressing the fillet that made the band’s edges refuses; deleting it is refused while the band uses it', () => {
  const doc = scenario();
  const suppressed: StudioDoc = prefixDoc({ ...doc, nodes: doc.nodes.map((n, i) => i === 2 ? { ...n, suppressed: true as const } : n) }, doc.nodes.length);
  const r = evaluateDoc(suppressed, 1);
  assert.ok(!r.ok); if (!r.ok) assert.match(JSON.stringify(r.error), /BAND_EDGE_LOST|REFERENCE_MOVED|no edge named/);
  const del = deleteFeature(doc, 2);
  assert.ok('error' in del); if ('error' in del) assert.match(del.error, /used by feature 5|refers to the/);
  // A suppressed or removed parent body makes the band gone, not an error (the Boolean's rule).
  const cyl: StudioDoc = prefixDoc({ ...doc, nodes: doc.nodes.map((n, i) => i === 4 ? { ...n, suppressed: true as const } : n) }, doc.nodes.length);
  const g = evaluateDoc(cyl, 1); assert.ok(g.ok); if (g.ok) assert.ok(g.bodies.every(b => !b.band));
});

test('no silent retarget: a name a fillet would be re-matched to is held on a band, never substituted', async () => {
  // Two boxes: a fillet on one's top edge, a band on the other's top loop; each stored name's signature is moved to the
  // opposite parallel edge, so the one matcher finds exactly one other edge as the name's match.
  const sk = (x: number): ModelNode => ({ kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + 20, 20] });
  const circle: ModelNode = { kind: 'sketch', profile: 'circle', center: [110, 10], radius: 8 };
  const base = prefixDoc({ ...emptyDoc(), nodes: [sk(0), { kind: 'extrude', sketch: 0, height: 10 }, sk(100), { kind: 'extrude', sketch: 2, height: 10 }, circle, { kind: 'extrude', sketch: 4, height: 10, from: 30 }] }, 6);
  const p = keyOf(base, 1), q = keyOf(base, 3), c = keyOf(base, 5);
  const pTop = topEdges(p), qTop = topEdges(q);
  const parallel = (edges: typeof pTop) => { const e = edges[0], o = edges.find(x => x !== e && Math.abs(Math.abs(x.a[0] - x.b[0]) - Math.abs(e.a[0] - e.b[0])) < 1e-9 && Math.abs(Math.abs(x.a[1] - x.b[1]) - Math.abs(e.a[1] - e.b[1])) < 1e-9)!; return [e, o] as const; };
  const [pe, po] = parallel(pTop), [qe, qo] = parallel(qTop);
  // (The band comes first: a fillet whose signature is wrong would stop the evaluation the band's check starts from.)
  let doc = withNode(base, { kind: 'band-surface', version: 1, a: { parent: solid(3), edges: namesOf(qTop) }, b: { parent: solid(5), edges: namesOf(topEdges(c)) } });
  doc = withNode(doc, { kind: 'fillet', parent: solid(1), edges: [pe.names[0]], radius: 1 });
  doc = captureSignatures(doc, bodies(prefixDoc(doc, 7)));
  // Move one stored signature: the name now looks like its parallel opposite. (One at a time: a moved signature refuses the
  // evaluation the next feature's check starts from.)
  const moveFillet = prefixDoc({ ...doc, nodes: doc.nodes.map(n => n.kind === 'fillet' ? { ...n, sigs: { [pe.names[0]]: n.sigs![po.names[0]] ?? sigOf(p, po.names[0]) } } : n) }, doc.nodes.length);
  const moveBand = prefixDoc({ ...doc, nodes: doc.nodes.map(n => n.kind === 'band-surface' ? { ...n, sigs: { ...n.sigs, [qe.names[0]]: n.sigs![qo.names[0]] } } : n) }, doc.nodes.length);
  const f = await verifyReferences(moveFillet, [], evaluate);
  assert.ok(f.changes.some(c => c.where === 'feature 7' && c.was === pe.names[0] && c.now === po.names[0]), 'the fillet’s name is re-matched (marked)');
  const v = await verifyReferences(moveBand, [], evaluate);
  assert.deepEqual(v.changes, [], 'the band is not substituted');
  const held = bandOf(v.doc);
  assert.equal(held.suppressed, true); assert.equal(held.held, `"${qe.names[0]}" could be ${qo.names[0]}`);
  assert.ok(held.a.edges.includes(qe.names[0])); assert.equal(held.rematched, undefined);
  assert.ok(v.problems.some(x => x.name === qe.names[0] && x.candidates.join() === qo.names[0]));
  // The rest builds with the band held.
  assert.ok(bodies(v.doc).every(b => !b.band));
  void referencesOf;
});
function sigOf(b: BodyResult, name: string): Sig {
  const e = b.mesh.edges.find(x => x.names.includes(name))!, d = [e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]], l = Math.hypot(...d);
  return { k: 'line', p: [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2, (e.a[2] + e.b[2]) / 2], d: [d[0] / l, d[1] / l, d[2] / l], s: l };
}

test('a chat edit that loses a band name refuses; one that moves it refuses; one that keeps the names passes (strict, like the wrap)', async () => {
  const { doc: withBand } = plain();
  const taller = prefixDoc({ ...withBand, nodes: withBand.nodes.map((n, i) => i === 1 && n.kind === 'extrude' ? { ...n, height: 14 } : n) }, withBand.nodes.length);
  const same = await rematchNames(withBand, taller, evaluate);
  assert.ok(!('error' in same)); if (!('error' in same)) assert.deepEqual(same.changes, []);
  const lost = prefixDoc({ ...withBand, nodes: withBand.nodes.map((n, i) => i === 0 ? triangle : n) }, withBand.nodes.length);
  const r = await rematchNames(withBand, lost, evaluate);
  assert.ok('error' in r); if ('error' in r) assert.match(r.error, /is gone after this edit|is now one of/);
  // The sketch's side ids rotated: each name now stands on its neighbour's geometry — a unique match that a band never follows.
  const rotated = { ...LOOP, sideTags: { outer: ['e3', 'e0', 'e1', 'e2'] } } as ModelNode;
  const moved = prefixDoc({ ...withBand, nodes: withBand.nodes.map((n, i) => i === 0 ? rotated : n) }, withBand.nodes.length);
  const m = await rematchNames(withBand, moved, evaluate);
  assert.ok('error' in m); if ('error' in m) assert.match(m.error, /^\[BAD_REFERENCE\] Band surface: the edge ".*" moved to ".*" and a band never follows it silently/);
});

test('save and open: the node survives the file and the band evaluates the same; migrate admits the kind', async () => {
  const doc = scenario();
  const read = readStudioDoc(JSON.stringify(doc));
  assert.ok('doc' in read); if ('doc' in read) { assert.deepEqual(bandOf(read.doc), JSON.parse(JSON.stringify(bandOf(doc)))); assert.equal(bandBody(read.doc).band!.pairs, 10); }
  const file = await readStudioFile(encodeStudioFile(doc));
  assert.ok(!('error' in file), JSON.stringify(file));
  if ('doc' in file) assert.deepEqual(bandOf(file.doc), JSON.parse(JSON.stringify(bandOf(doc))));
  const bad = JSON.parse(JSON.stringify(doc)); bad.nodes[5].a.edges = Array.from({ length: 40 }, (_, i) => `x${i}`);
  assert.ok('error' in readStudioDoc(JSON.stringify(bad)));
  const thick = JSON.parse(JSON.stringify(doc)); thick.nodes[5].thickness = 2;
  assert.match((readStudioDoc(JSON.stringify(thick)) as { error: string }).error, /#2258/);
});

test('undo snapshot: the document before the band is the prefix of the one after; the band is renumbered after an earlier delete', () => {
  const doc = scenario(), before = prefixDoc(doc, 5);
  assert.deepEqual(before.nodes, doc.nodes.slice(0, 5));
  // A fixture built by hand with an unused solid first (indices 3 and 5 for the band's parents): deleting it renumbers the band's
  // two parents; the names keep their ids.
  const { doc: shifted, a, b, first } = plain(true);
  assert.equal(first, 2); assert.deepEqual(parentsOf(bandOf(shifted)), [3, 5]);
  const gone = deleteFeature(shifted, 1);
  assert.ok(!('error' in gone), JSON.stringify(gone));
  if (!('error' in gone)) {
    assert.deepEqual(gone.removed, [0, 1]);
    const band = bandOf(gone.doc);
    assert.deepEqual([band.a.parent.node, band.b.parent.node], [1, 3]);
    assert.deepEqual(band.a.edges, a); assert.deepEqual(band.b.edges, b);
    assert.ok(bodies(gone.doc).some(x => x.band));
  }
});

test('names: a feature a band’s edge names belong to is one the band depends on, not only a parent', () => {
  // Hand-made: the band's parents are other bodies, its name is one feature 1 made — deleting or moving feature 1 must see it.
  const sq = (x: number): ModelNode => ({ kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + 10, 10] });
  const nodes: ModelNode[] = [sq(0), { kind: 'extrude', sketch: 0, height: 5 }, sq(50), { kind: 'extrude', sketch: 2, height: 5 }, sq(100), { kind: 'extrude', sketch: 4, height: 5 }];
  const base = prefixDoc({ ...emptyDoc(), nodes }, nodes.length);
  const doc = withNode(base, { kind: 'band-surface', version: 1, a: { parent: solid(3), edges: ['n1.side0|n1.top'] }, b: { parent: solid(5), edges: ['n5.side0|n5.top'] } });
  assert.deepEqual(featureDependents(doc, 1), [6]);
  assert.deepEqual(featureDependents(doc, 3), [6]);
  assert.deepEqual(featureDependents(base, 1), []);
});

test('flip reaches the kernel feature and changes the band', () => {
  const { doc } = plain(), flipped = prefixDoc({ ...doc, nodes: doc.nodes.map(n => n.kind === 'band-surface' ? { ...n, flip: true as const } : n) }, doc.nodes.length);
  const native = toPartDocument(flipped).features.at(-1)!;
  assert.equal(native.kind, 'band-surface'); if (native.kind === 'band-surface') assert.equal(native.flip, true);
  const plainNative = toPartDocument(doc).features.at(-1)!; if (plainNative.kind === 'band-surface') assert.equal(plainNative.flip, undefined);
  assert.notEqual(bandBody(flipped).area, bandBody(doc).area);
});

test('flatten refuses a document with a band', () => {
  assert.throws(() => flattenAssembly(scenario()), /Band surface/);
});

function context(doc: StudioDoc, selection: Ctx['selection']): Ctx { return { doc, bodies: bodies(doc), selection }; }
const indexOfBody = (ctx: Ctx, node: number) => ctx.bodies.findIndex(b => b.ref?.node === node);
const topLoopSelection = (ctx: Ctx, node: number) => { const b = ctx.bodies[indexOfBody(ctx, node)]; return topEdges(b).map(e => ({ body: indexOfBody(ctx, node), edge: e.index })); };

test('command: A from a selection or a face, B by clicks, Flip, build equals the hand node and the first refusals', () => {
  const doc = prefixDoc(scenario(), 5), ctx0 = context(doc, { faces: [], edges: [], bodies: [] });
  assert.equal(commandById('band-surface'), bandSurfaceCommand);
  assert.ok(!CHAT_COMMANDS.includes('band-surface'));
  assert.equal(bandSurfaceCommand.available(ctx0).ok, false);
  const aBody = indexOfBody(ctx0, 2), bBody = indexOfBody(ctx0, 4);
  const ctx = { ...ctx0, selection: { faces: [], edges: topLoopSelection(ctx0, 2), bodies: [] } };
  assert.equal(bandSurfaceCommand.available(ctx).ok, true);
  const d = bandSurfaceCommand.defaults!(ctx);
  assert.equal(d.b, ''); assert.equal(d.flip, 'no'); assert.equal(d.chain, 'tangent');
  assert.equal(bandPicksOf(d).length, 1); assert.equal(bandPicksOf(d)[0].names.length, 8);
  assert.throws(() => bandSurfaceCommand.build!(ctx, d), /pick side A and side B/);
  assert.match(bandSurfaceCommand.steps!(ctx, d)[0].text, /^8 edges on .*\(closed\)$/);
  assert.equal(bandSurfaceCommand.steps!(ctx, d)[1].done, false);
  // B: click one rim edge (tangent chain: the whole loop); clicking again removes it.
  const rim = ctx.bodies[bBody].mesh.edges.find(e => e.faces.includes(topFace(ctx.bodies[bBody]).index))!;
  const picked = bandSurfaceCommand.onPick!(ctx, d, { face: null, edge: { body: bBody, edge: rim.index } }) as Values;
  assert.equal(bandPicksOf(picked).length, 2);
  assert.match(bandSurfaceCommand.steps!(ctx, picked)[2].text, /^8↔2 edges, paired when it is built$/);
  const unpicked = bandSurfaceCommand.onPick!(ctx, picked, { face: null, edge: { body: bBody, edge: rim.index } }) as Values;
  assert.equal(unpicked.b, '');
  // An edge already on side A is refused for B; a face adds all its edges.
  const own = bandSurfaceCommand.onPick!(ctx, d, { face: null, edge: { body: aBody, edge: topLoopSelection(ctx, 2)[0].edge } });
  assert.match((own as { error: string }).error, /already on side A/);
  const byFace = bandSurfaceCommand.onPick!(ctx, d, { face: { body: bBody, face: topFace(ctx.bodies[bBody]).index }, edge: null }) as Values;
  assert.deepEqual(bandPicksOf(byFace)[1].names, bandOf(scenario()).b.edges);
  assert.equal(bandSurfaceCommand.onPick!(ctx, d, { face: null, edge: null }), null);
  // Build equals the hand node (signatures captured); Flip is stored.
  const built = bandSurfaceCommand.build!(ctx, picked), hand = scenario();
  assert.deepEqual({ ...bandOf(built), id: undefined }, { ...bandOf(hand), id: undefined });
  const flipped = bandSurfaceCommand.build!(ctx, { ...picked, flip: 'yes' });
  assert.equal(bandOf(flipped).flip, true);
  assert.notEqual(bodies(flipped).find(b => b.band)!.volume, undefined);
  // The undo snapshot: building leaves the context's document alone.
  assert.equal(ctx.doc.nodes.length, 5);
  // One body with a face of several loops is refused as a pick.
  assert.ok(!('error' in (bandSurfaceCommand.onPick!(ctx, d, { face: { body: bBody, face: topFace(ctx.bodies[bBody]).index }, edge: null }) as object)));
});

test('edit command: Flip, Re-pick empties the side and replaces it by clicks, a body at or after the band is refused', () => {
  const doc = scenario(), ctx = context(doc, { faces: [], edges: [], bodies: [] });
  const cmd = editCommand(5, doc.nodes);
  assert.ok(cmd); assert.equal(cmd!.id, 'edit'); assert.equal(cmd!.available(ctx).ok, true);
  const direct = bandSurfaceEditCommand(5, bandOf(doc));
  assert.equal(direct.fields!(ctx).map(f => f.key).join(), 'flip,repick,chain');
  assert.ok(!direct.fields!(ctx).some(f => f.key === 't' || f.key === 'side'));
  const v0 = cmd!.defaults!(ctx);
  assert.equal(v0.repick, 'keep'); assert.equal(v0.flip, 'no');
  assert.deepEqual(bandPicksOf(v0).map(p => p.side), ['a', 'b']);
  // Flip: the same names, flipped.
  const flipped = cmd!.build!(ctx, { ...v0, flip: 'yes' });
  assert.equal(bandOf(flipped).flip, true); assert.deepEqual(bandOf(flipped).a, bandOf(doc).a); assert.ok(bandOf(flipped).sigs);
  // Re-pick B: empties B; a click on the cylinder rim sets it again; a click on the band's own body is refused.
  const v1 = patch(cmd!, ctx, v0, { repick: 'b' });
  assert.equal(v1.b, ''); assert.deepEqual(bandPicksOf(v1).map(p => p.side), ['a']);
  assert.throws(() => cmd!.build!(ctx, v1), /pick side A and side B/);
  const bBody = indexOfBody(ctx, 4), rim = ctx.bodies[bBody].mesh.edges.find(e => e.faces.includes(topFace(ctx.bodies[bBody]).index))!;
  const v2 = cmd!.onPick!(ctx, v1, { face: null, edge: { body: bBody, edge: rim.index } }) as Values;
  assert.deepEqual(bandPicksOf(v2)[1].names, bandOf(doc).b.edges);
  const late = ctx.bodies.findIndex(b => b.ref?.node === 5), anyEdge = ctx.bodies[late].mesh.edges[0];
  const refused = cmd!.onPick!(ctx, v1, { face: null, edge: { body: late, edge: anyEdge.index } });
  assert.ok(refused && 'error' in refused); assert.match((refused as { error: string }).error, /Roll back/);
  // Keep restores both; with Keep a click is not a pick.
  const v3 = patch(cmd!, ctx, v1, { repick: 'keep' });
  assert.deepEqual(bandPicksOf(v3).map(p => p.side), ['a', 'b']);
  assert.equal(cmd!.onPick!(ctx, v3, { face: null, edge: { body: bBody, edge: rim.index } }), null);
  // Re-pick A with another chain drops the old names' signatures and captures the new.
  const aBody = indexOfBody(ctx, 2), v4 = patch(cmd!, ctx, v0, { repick: 'a' });
  assert.equal(v4.a, '');
  const rebuilt = cmd!.build!(ctx, { ...v4, a: JSON.stringify(bandOf(doc).a) });
  assert.deepEqual(bandOf(rebuilt).a, bandOf(doc).a);
  void aBody;
});
function patch(cmd: NonNullable<ReturnType<typeof editCommand>>, ctx: Ctx, v: Values, p: Values): Values {
  const next = { ...v, ...p };
  return cmd.derive ? cmd.derive(ctx, next, Object.keys(p)) : next;
}

test('agent: checkNode accepts a valid band and refuses the bad ones; thickness waits on #2258', () => {
  const doc = scenario(), nodes = doc.nodes.slice(0, 5), band = bandOf(doc);
  const raw = { kind: 'band-surface', version: 1, a: band.a, b: band.b };
  assert.equal(checkNode(raw, nodes, {}), null);
  assert.equal(bandSurfaceNodeProblem(raw, nodes, {}), null);
  assert.equal(checkNode({ ...raw, flip: true }, nodes, {}), null);
  assert.match(checkNode({ ...raw, thickness: 2 }, nodes, {})!, /thickening waits on exact thicken \(#2258\)/);
  assert.match(checkNode({ ...raw, side: 'normal' }, nodes, {})!, /#2258/);
  assert.match(checkNode({ ...raw, a: { ...band.a, parent: solid(1) } }, nodes, {})!, /not a visible body/);
  assert.match(checkNode({ ...raw, b: { ...band.b, edges: [band.a.edges[0]] } }, nodes, {})!, /named twice/);
  assert.match(checkNode({ ...raw, a: { ...band.a, edges: Array.from({ length: 33 }, (_, i) => `x${i}`) } }, nodes, {})!, /1 to 32/);
  assert.match(checkNode({ ...raw, a: { ...band.a, edges: [] } }, nodes, {})!, /1 to 32/);
  assert.match(checkNode({ ...raw, flip: false }, nodes, {})!, /flip/);
  assert.match(checkNode({ ...raw, version: 2 }, nodes, {})!, /version/);
  assert.match(checkNode({ ...raw, colour: 1 }, nodes, {})!, /unknown field/);
  assert.match(checkNode({ ...raw, a: { ...band.a, parent: solid(9) } }, nodes, {})!, /not a visible body/);
  void toPartDocument;
});

test('kernel feature: both targets are read, the stored signatures go as the kernel’s expectation', () => {
  const doc = scenario(), native = toPartDocument(doc).features.at(-1)!;
  assert.equal(native.kind, 'band-surface');
  if (native.kind === 'band-surface') {
    assert.equal(native.a.target, 'n2'); assert.equal(native.b.target, 'n4');
    assert.deepEqual(native.a.edges, bandOf(doc).a.edges);
    assert.ok(native.expect && Object.keys(native.expect).length > 0);
    assert.ok(!('thickness' in native) && !('side' in native));
  }
});

/** Two coaxial cylinders (n1 radius 20, n3 radius 10 above) and the band between n1's top rim and n3's bottom rim. */
function cylinders(): StudioDoc {
  const base = prefixDoc({ ...emptyDoc(), nodes: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 }, { kind: 'extrude', sketch: 0, height: 10 }, { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, { kind: 'extrude', sketch: 2, height: 10, from: 40 }] as ModelNode[] }, 4);
  const b0 = bodies(base), rim = (b: BodyResult, up: boolean) => { const f = b.mesh.faces.find(x => x.kind === 'plane' && (up ? x.normal[2] > 0.99 : x.normal[2] < -0.99))!; return namesOf(b.mesh.edges.filter(e => e.faces.includes(f.index))); };
  const a = rim(b0.find(b => b.ref?.node === 1)!, true), b = rim(b0.find(b => b.ref?.node === 3)!, false);
  return captureSignatures(withNode(base, { kind: 'band-surface', version: 1, a: { parent: solid(1), edges: a }, b: { parent: solid(3), edges: b } }), b0);
}

test('editing a band still works after a later feature consumed one of its bodies (the edit validates against the features before it)', () => {
  const doc = withNode(cylinders(), { kind: 'translate', parent: solid(3), offset: [0, 0, 5] });
  assert.ok(!leafBodies(doc.nodes).some(r => r.node === 3), 'the cylinder is consumed now');
  const ctx = context(doc, { faces: [], edges: [], bodies: [] }), cmd = editCommand(4, doc.nodes)!;
  assert.equal(cmd.available(ctx).ok, true);
  const flipped = cmd.build!(ctx, { ...cmd.defaults!(ctx), flip: 'yes' });
  assert.equal(bandOf(flipped).flip, true); assert.ok(bodies(flipped).some(b => b.band));
  // The chat/agent check of the same node against the features before it accepts it too.
  assert.equal(checkNode(doc.nodes[4], doc.nodes.slice(0, 4), doc.parameters), null);
});

test('STEP leaves the band sheet out and says so; the facade refuses rather than drop it silently', () => {
  const doc = cylinders();
  const step = exportStudioStep(doc, { name: 'band' });
  assert.ok(step.text.length > 100);
  assert.equal(step.omitted?.length, 1); assert.match(step.omitted![0], /^band sheet b4 not included: STEP of band sheets is not supported yet$/);
  assert.equal((step.text.match(/CLOSED_SHELL/g) ?? []).length, 2, 'the two cylinders only');
  assert.throws(() => stepOf(doc, 'band'), /band sheet b4 not included/);
  // Without the band: no omission.
  assert.equal(exportStudioStep(prefixDoc(doc, 4), { name: 'x' }).omitted, undefined);
});

test('HUD pairing: edge counts before the band is evaluated, the kernel’s pieces, pairing and patches after', () => {
  const doc = cylinders(), pre = prefixDoc(doc, 4), band = bandOf(doc);
  const cmdCtx = context(pre, { faces: [], edges: [], bodies: [] });
  const v = { a: JSON.stringify(band.a), b: JSON.stringify(band.b), flip: 'no', chain: 'tangent' };
  assert.equal(bandSurfaceCommand.steps!(cmdCtx, v)[2].text, `${band.a.edges.length}↔${band.b.edges.length} edges, paired when it is built`);
  const evaluated = context(doc, { faces: [], edges: [], bodies: [] }), report = bandBody(doc).band!;
  const cmd = editCommand(4, doc.nodes)!, text = cmd.steps!(evaluated, cmd.defaults!(evaluated))[2].text;
  assert.equal(text, `${report.pieces[0]}↔${report.pieces[1]} ${report.pairing === 'pieces' ? 'pieces' : 'by length'} → ${report.pairs} patches`);
  assert.match(text, /^2↔2 pieces → 2 patches$/);
  const sc = scenario(), c2 = context(sc, { faces: [], edges: [], bodies: [] }), e2 = editCommand(5, sc.nodes)!;
  assert.match(e2.steps!(c2, e2.defaults!(c2))[2].text, /^8↔2 by length → 10 patches$/);
});
