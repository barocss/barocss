import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { rectanglePart, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { addLibraryPartToBody, libraryById, thicknessAt } from '../src/library/libraries';
import { loadCadLibrary, instantiateLibraryPart } from '@barocss/cad';

// R6b.1 (D65): a screw boss from the built-in enclosure library, added to a body as one step: placed on a face by its
// base, united with it; its checks read the wall measured there.
type LibraryNode = Extract<ModelNode, { kind: 'library' }>;
const bodies = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : `${r.error.title} ${r.error.hint}`); return r.ok ? r.bodies : []; };
const plate = (t: number) => rectanglePart(60, 40, t);
const top = (t: number, x: number, y: number) => ({ body: { node: 1, side: 'solid' as const }, face: 'n1.top', point: [x, y, t] as [number, number, number], normal: [0, 0, 1] as [number, number, number] });

test('the screw boss: M2–M5 with and without gussets build valid; without gussets its volume the closed form; its rules read the wall', () => {
  const lib = libraryById('enclosure')!;
  for (const v of ['M2', 'M2.5', 'M3', 'M4', 'M5']) for (const ribs of [0, 4]) {
    const i = instantiateLibraryPart(lib, 'screw-boss', { variant: v, params: { ribs }, context: { wall: 2.5 } });
    assert.ok(i.features.length >= 3, v);
  }
  // (M3, h 8: the cylinder Ø6.4 × 8 less the Ø2.5 pilot 7.4 deep.)
  const m3 = addLibraryPartToBody(plate(2.5), 'enclosure', 'screw-boss', { variant: 'M3', params: { ribs: 0 } }, top(2.5, 20, 20));
  assert.ok(!('error' in m3), JSON.stringify(m3));
  const v = bodies((m3 as { doc: StudioDoc }).doc)[0].volumeMM3!, boss = Math.PI * 3.2 ** 2 * 8 - Math.PI * 1.25 ** 2 * 7.4;
  assert.ok(Math.abs(v - (60 * 40 * 2.5 + boss)) < 1e-6, `${v} vs ${60 * 40 * 2.5 + boss}`);
});

test('added to a body as one step: on the top face — the wall measured there (2.5), its rules met, one body, the gussets in; on a 1.2 mm wall — warned (the boss wall thick, the gussets sink), with margins; half off the edge — refused, saying how much; suppressed — the plate as it was', () => {
  const r = addLibraryPartToBody(plate(2.5), 'enclosure', 'screw-boss', { variant: 'M3' }, top(2.5, 20, 20));
  assert.ok(!('error' in r), JSON.stringify(r));
  const doc = (r as { doc: StudioDoc }).doc, node = (r as { node: LibraryNode }).node;
  assert.deepEqual(node.context, { wall: 2.5 }); assert.deepEqual(node.addTo, { node: 1, side: 'solid' }); assert.equal(node.on!.face, 'n1.top');
  assert.ok(!node.warnings.some(w => /^(boss|rib|engagement)/.test(w)), node.warnings.join(' | '));
  const b = bodies(doc);
  assert.equal(b.length, 1, 'one body: the boss is part of the plate');
  assert.ok(b[0].volumeMM3! > 60 * 40 * 2.5 + Math.PI * 3.2 ** 2 * 8 - Math.PI * 1.25 ** 2 * 7.4, 'the gussets add to it');
  // (Its bounds: the boss stands 8 above the 2.5 mm plate.)
  assert.ok(Math.abs(b[0].mesh.bounds.max[2] - 10.5) < 1e-6);
  // A thin wall: warned with the margins, the wall measured.
  const thin = addLibraryPartToBody(plate(1.2), 'enclosure', 'screw-boss', { variant: 'M3' }, top(1.2, 20, 20)) as { node: LibraryNode };
  assert.deepEqual(thin.node.context, { wall: 1.2 });
  assert.ok(thin.node.warnings.some(w => /^boss-wall-thick: .* \(1\.625\)$/.test(w)) && thin.node.warnings.some(w => /^rib-sink: .* \(0\.833333\)$/.test(w)), thin.node.warnings.join(' | '));
  // A wall thinner than the gussets: refused (feasible).
  const tooThin = addLibraryPartToBody(plate(0.8), 'enclosure', 'screw-boss', { variant: 'M3' }, top(0.8, 20, 20));
  assert.match((tooThin as { error: string }).error, /rib-wall: a gusset thicker than the wall it stands on \(1\.25\)/);
  // Half off the plate: refused, never added half on.
  const off = addLibraryPartToBody(plate(2.5), 'enclosure', 'screw-boss', { variant: 'M3' }, top(2.5, 1, 20));
  assert.match((off as { error: string }).error, /base is not all on the body: \d+ of \d+ points of its footprint fall off it/);
  // On the side face (x = 60, facing +X): lying along X.
  const side = addLibraryPartToBody(plate(10), 'enclosure', 'screw-boss', { variant: 'M2', params: { ribs: 0 } }, { body: { node: 1, side: 'solid' }, face: 'n1.side1', point: [60, 20, 5], normal: [1, 0, 0], xDir: [0, 1, 0] });
  assert.ok(!('error' in side), JSON.stringify(side));
  assert.ok(Math.abs(bodies((side as { doc: StudioDoc }).doc)[0].mesh.bounds.max[0] - 68) < 1e-6);
  // Suppressed: the plate as it was.
  const sup = { ...doc, nodes: doc.nodes.map((n, i) => i === 2 ? { ...n, suppressed: true as const } : n) };
  assert.ok(Math.abs(bodies(sup)[0].volumeMM3! - 60 * 40 * 2.5) < 1e-6);
  // No wall measured (the ray leaves nothing): the wall rules unknown, said.
  assert.equal(thicknessAt(bodies(plate(2.5))[0].mesh, [100, 100, 2.5], [0, 0, 1]), null);
  const lib = loadCadLibrary(libraryById('enclosure')!.manifest), i = instantiateLibraryPart(lib, 'screw-boss', { variant: 'M3' });
  assert.ok(i.warnings.some(w => /^boss-wall-thin: unknown — needs wall/.test(w)));
});

test('the agent tool add_library_part: on a plate\'s top face by its name and a point, the wall measured, warnings returned; a face that is not flat refused', async () => {
  const { dispatchTool } = await import('../src/chat/tools');
  const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);
  const s = { doc: plate(2.5), bodies: bodies(plate(2.5)) };
  const r = await dispatchTool(s, 'add_library_part', { library: 'enclosure', part: 'screw-boss', variant: 'M3', face: 'n1.top', point: [20, 20, 2.5] }, evaluate);
  assert.ok(!r.isError, r.content);
  const out = JSON.parse(r.content);
  assert.deepEqual([out.added, out.context], ['Screw boss M3', { wall: 2.5 }]);
  assert.equal(bodies(r.state.doc).length, 1);
  const bad = await dispatchTool(s, 'add_library_part', { library: 'enclosure', part: 'screw-boss', face: 'n1.nope', point: [0, 0, 0] }, evaluate);
  assert.ok(bad.isError); assert.match(JSON.parse(bad.content).error, /not a flat face/);
});

test('library_check as a requirement: a boss\'s rule margins on the plate (met), on a thin wall (not met, the margin), unknown for a rule it lacks', async () => {
  const { runCheck } = await import('../src/chat/spec');
  const r = addLibraryPartToBody(plate(1.2), 'enclosure', 'screw-boss', { variant: 'M3' }, top(1.2, 20, 20)) as { doc: StudioDoc };
  const b = bodies(r.doc), ev = async () => evaluateDoc(r.doc, 1);
  const id = r.doc.nodes[2].id!;
  const sink = await runCheck(r.doc, b, ev as never, { op: '<=', query: { fn: 'library_check', feature: id, check: 'rib-sink' }, value: 0.6 });
  assert.deepEqual([sink.status, sink.measured], ['fail', 0.8333]);
  const eng = await runCheck(r.doc, b, ev as never, { op: '>=', query: { fn: 'library_check', feature: id, check: 'engagement' }, value: 2 });
  assert.equal(eng.status, 'pass');
  const none = await runCheck(r.doc, b, ev as never, { op: '>=', query: { fn: 'library_check', feature: id, check: 'nope' }, value: 0 });
  assert.equal(none.status, 'unknown'); assert.match(none.why!, /no rule nope/);
});

test('R6b.2 heat-set insert hole: cut into a boss\'s top — the material under it and round it measured (the pilot hole inside its radius ignored); the volume less exactly the hole beyond the pilot; too shallow a wall refused (it would break through); off the boss refused', () => {
  const boss = addLibraryPartToBody(plate(2.5), 'enclosure', 'screw-boss', { variant: 'M3' }, top(2.5, 20, 20)) as { doc: StudioDoc };
  const before = bodies(boss.doc)[0];
  const bossTop = { body: before.ref!, face: 'lib1_b.top', point: [20, 20, 10.5] as [number, number, number], normal: [0, 0, 1] as [number, number, number] };
  const r = addLibraryPartToBody(boss.doc, 'enclosure', 'insert-hole', { variant: 'M3' }, bossTop);
  assert.ok(!('error' in r), JSON.stringify(r));
  const node = (r as { node: LibraryNode }).node;
  // (10.5 deep under the boss's top; round the axis 2.5 down the boss's 3.2 radius, at 45° clear of the gussets.)
  assert.deepEqual([node.cut, node.context!.depth], [true, 10.5]); assert.ok(Math.abs(node.context!.around - 3.2) < 1e-3, String(node.context!.around));
  assert.ok(node.warnings.some(w => /^boss-size: .* \(0\.69/.test(w)), node.warnings.join(' | '));
  const after = bodies((r as { doc: StudioDoc }).doc)[0];
  // (A Ø4 × 5 hole where the Ø2.5 pilot already was: π (2² − 1.25²) 5 taken.)
  assert.ok(Math.abs(before.volumeMM3! - after.volumeMM3! - Math.PI * (4 - 1.5625) * 5) < 1e-6, String(before.volumeMM3! - after.volumeMM3!));
  // Into the bare 2.5 mm plate: it would break through.
  assert.match((addLibraryPartToBody(plate(2.5), 'enclosure', 'insert-hole', { variant: 'M3' }, top(2.5, 30, 20)) as { error: string }).error, /breaks-through: .* \(-2\.5\)/);
  // Its mouth over the plate's edge: refused, its outline not all on the body.
  assert.match((addLibraryPartToBody(plate(10), 'enclosure', 'insert-hole', { variant: 'M3' }, top(10, 0.5, 20)) as { error: string }).error, /not all on the body|wall-round/);
});

test('R6b.2 PCB standoffs and hole alignment: four standoffs on a floor under an imported board (a STEP with four Ø3.2 holes) line up to 1e-9; one moved 0.3 mm is off by 0.3 — as a requirement it fails, said', async () => {
  const { evaluateCadPart, exportStep } = await import('@barocss/cad');
  const { emptyDoc, withNode } = await import('../src/engine/doc');
  const { runCheck } = await import('../src/chat/spec');
  const holes = [[4, 4], [46, 4], [4, 36], [46, 36]];
  const board = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [50, 40] }, { id: 'pcb', kind: 'extrude', sketch: 's', height: 1.6 },
    ...holes.map(([x, y], k) => ({ id: `h${k}`, kind: 'hole', target: k ? `h${k - 1}` : 'pcb', center: [x, y], radius: 1.6 }))] as never }).output('h3').brep;
  const step = exportStep([board], { name: 'pcb' });
  const place = (shift = 0) => {
    let doc = rectanglePart(70, 60, 2);
    for (const [k, [x, y]] of holes.entries()) {
      const leaf = bodies(doc)[0].ref!;
      const r = addLibraryPartToBody(doc, 'enclosure', 'pcb-standoff', { variant: 'M2.5', params: { h: 6 } }, { body: leaf, face: 'n1.top', point: [x + 6 + (k === 1 ? shift : 0), y + 6, 2], normal: [0, 0, 1] });
      assert.ok(!('error' in r), JSON.stringify(r)); doc = (r as { doc: StudioDoc }).doc;
    }
    // The board as a placed part on the standoffs' tops (z 2 + 6), its holes over them.
    return { ...doc, instances: [{ id: 'p1', name: 'PCB', doc: withNode(emptyDoc(), { kind: 'import', name: 'pcb', step }), position: [6, 6, 8] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }] };
  };
  const doc = place(), b = bodies(doc), ev = async () => evaluateDoc(doc, 1);
  const ok = await runCheck(doc, b, ev as never, { op: '<=', query: { fn: 'hole_alignment', board: 'p1' }, value: 0.05, unit: 'mm' });
  assert.equal(ok.status, 'pass', JSON.stringify(ok)); assert.ok(Math.abs(ok.measured as number) < 1e-9);
  const off = place(0.3), bad = await runCheck(off, bodies(off), (async () => evaluateDoc(off, 1)) as never, { op: '<=', query: { fn: 'hole_alignment', board: 'p1' }, value: 0.05, unit: 'mm' });
  assert.deepEqual([bad.status, bad.measured], ['fail', 0.3]); assert.match(bad.hint!, /off .* by 0\.3 mm/);
  const none = await runCheck(doc, b, ev as never, { op: '<=', query: { fn: 'hole_alignment', board: 'p9' }, value: 0.05 });
  assert.equal(none.status, 'unknown'); assert.match(none.why!, /no part p9/);
});
