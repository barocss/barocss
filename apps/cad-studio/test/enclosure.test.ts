import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { addLibraryPartToBody, libraryById, thicknessAt } from '@barocss/cad-model/library/libraries';
import { loadCadLibrary, instantiateLibraryPart } from '@barocss/cad';

// R6b.1 (D65): a screw boss from the built-in enclosure library, added to a body as one step: placed on a face by its
// base, united with it; its checks read the wall measured there.
type LibraryNode = Extract<ModelNode, { kind: 'library' }>;
const bodies = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : `${r.error.title} ${r.error.hint}`); return r.ok ? r.bodies : []; };
const plate = (t: number, process: string | null = 'injection') => ({ ...rectanglePart(60, 40, t), ...(process ? { process } : {}) });
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
  assert.deepEqual(node.context, { wall: 2.5, bossWallMax: 1, bossWallMin: 0.6, ribMax: 1, ribRec: 0.6 }); assert.deepEqual(node.addTo, { node: 1, side: 'solid' }); assert.equal(node.on!.face, 'n1.top');
  assert.ok(!node.warnings.some(w => /^(boss|rib|engagement)/.test(w)), node.warnings.join(' | '));
  const b = bodies(doc);
  assert.equal(b.length, 1, 'one body: the boss is part of the plate');
  assert.ok(b[0].volumeMM3! > 60 * 40 * 2.5 + Math.PI * 3.2 ** 2 * 8 - Math.PI * 1.25 ** 2 * 7.4, 'the gussets add to it');
  // (Its bounds: the boss stands 8 above the 2.5 mm plate.)
  assert.ok(Math.abs(b[0].mesh.bounds.max[2] - 10.5) < 1e-6);
  // A thin wall: warned with the margins, the wall measured.
  const thin = addLibraryPartToBody(plate(1.2), 'enclosure', 'screw-boss', { variant: 'M3' }, top(1.2, 20, 20)) as { node: LibraryNode };
  assert.deepEqual(thin.node.context, { wall: 1.2, bossWallMax: 1, bossWallMin: 0.6, ribMax: 1, ribRec: 0.6 });
  assert.ok(thin.node.warnings.some(w => /^boss-wall-thick: .* \(1\.625\)$/.test(w)) && thin.node.warnings.some(w => /^rib-sink: .* \(0\.833333\)$/.test(w)), thin.node.warnings.join(' | '));
  // A wall thinner than the gussets: refused (feasible).
  const tooThin = addLibraryPartToBody(plate(0.8), 'enclosure', 'screw-boss', { variant: 'M3' }, top(0.8, 20, 20));
  assert.match((tooThin as { error: string }).error, /rib-wall: a gusset thicker than the process allows against the wall it stands on \(1\.25\)/);
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
  assert.ok(i.warnings.some(w => /^boss-wall-thin: unknown — needs bossWallMin \(.*\), wall \(the nominal wall/.test(w)), i.warnings.join(' | '));
});

test('the agent tool add_library_part: on a plate\'s top face by its name and a point, the wall measured, warnings returned; a face that is not flat refused', async () => {
  const { dispatchTool } = await import('@barocss/cad-model/chat/tools');
  const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);
  const s = { doc: plate(2.5), bodies: bodies(plate(2.5)) };
  const r = await dispatchTool(s, 'add_library_part', { library: 'enclosure', part: 'screw-boss', variant: 'M3', face: 'n1.top', point: [20, 20, 2.5] }, evaluate);
  assert.ok(!r.isError, r.content);
  const out = JSON.parse(r.content);
  assert.deepEqual([out.added, out.context], ['Screw boss M3', { wall: 2.5, bossWallMax: 1, bossWallMin: 0.6, ribMax: 1, ribRec: 0.6 }]);
  assert.equal(bodies(r.state.doc).length, 1);
  const bad = await dispatchTool(s, 'add_library_part', { library: 'enclosure', part: 'screw-boss', face: 'n1.nope', point: [0, 0, 0] }, evaluate);
  assert.ok(bad.isError); assert.match(JSON.parse(bad.content).error, /not a flat face/);
});

test('library_check as a requirement: a boss\'s rule margins on the plate (met), on a thin wall (not met, the margin), unknown for a rule it lacks', async () => {
  const { runCheck } = await import('@barocss/cad-model/chat/spec');
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
  const { emptyDoc, withNode } = await import('@barocss/cad-model/engine/doc');
  const { runCheck } = await import('@barocss/cad-model/chat/spec');
  const holes = [[4, 4], [46, 4], [4, 36], [46, 36]];
  const board = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [50, 40] }, { id: 'pcb', kind: 'extrude', sketch: 's', height: 1.6 },
    ...holes.map(([x, y], k) => ({ id: `h${k}`, kind: 'hole', target: k ? `h${k - 1}` : 'pcb', center: [x, y], radius: 1.6 }))] as never }).output('h3').brep;
  const step = exportStep([board], { name: 'pcb' });
  const place = (shift = 0) => {
    let doc: StudioDoc = { ...rectanglePart(70, 60, 2), process: 'injection' };
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

test('R6b.7 materials and process profiles: the data checked (every value sourced, the densities as before); the boss\'s thresholds from the process — FDM allows what moulding warns, no process leaves them unknown, said; a material value read from the body\'s material, unknown while it is assumed', async () => {
  const { MATERIALS_DATA, checkMaterials, materialData } = await import('@barocss/cad-model/library/materials');
  const { MATERIALS } = await import('@barocss/cad-model/app/materials');
  const { registerLibrary } = await import('@barocss/cad-model/library/libraries');
  const { withLook } = await import('@barocss/cad-model/app/bodies');
  assert.deepEqual(checkMaterials(MATERIALS_DATA), []);
  assert.deepEqual(MATERIALS.slice(0, 8).map(m => [m.id, m.gPerCm3]), [['al6061', 2.7], ['steel', 7.85], ['ss304', 8], ['brass', 8.5], ['ti64', 4.43], ['abs', 1.04], ['pla', 1.24], ['pa12', 1.01]]);
  assert.ok(MATERIALS_DATA.materials.every(m => m.estimate && Object.keys(m.sources).length >= 5));
  assert.deepEqual(MATERIALS_DATA.profiles.map(p => p.id), ['injection', 'fdm', 'sla', 'sls', 'mjf', 'cnc-milling', 'cnc-turning', 'die-casting', 'sand-casting']);
  // The same M3 boss on a 1.2 mm wall: moulding warns (sink, a thick boss wall); FDM does not; no process: unknown.
  const on = (process: string | null) => addLibraryPartToBody(plate(1.2, process), 'enclosure', 'screw-boss', { variant: 'M3' }, top(1.2, 20, 20)) as { node: LibraryNode };
  const w = (n: LibraryNode) => n.warnings.filter(x => /^(boss|rib|context)/.test(x));
  assert.deepEqual(w(on('injection').node).map(x => x.split(':')[0]), ['boss-wall-thick', 'rib-sink']);
  assert.deepEqual(w(on('fdm').node), []);
  const none = w(on(null).node);
  assert.ok(none.includes('rib-sink: unknown — needs ribRec (the process\'s recommended rib-to-wall ratio)') && none.includes('context ribRec: no process is chosen'), none.join(' | '));
  // A material value through the context: a test part reading the body's allowable strain.
  registerLibrary({ format: 'barocss-cad-library', version: 1, id: 'test-strain', name: 'Strain', libraryVersion: '1.0.0', units: 'mm', license: 'CC0-1.0',
    parts: [{ id: 'tab', name: 'Tab', parameters: { s: { value: 0.02, source: 'test' } }, operation: 'add',
      context: { eps: { unit: 'ratio', description: 'the material\'s allowable strain', from: ['material.allowableStrain'] } },
      checks: [{ id: 'strain', expr: 's <= eps', value: 's / eps', level: 'recommended', message: 'strained past the material' }],
      recipe: [{ id: 'q', kind: 'sketch', profile: 'rectangle', min: [-2, -2], max: [2, 2] }, { id: 't', kind: 'extrude', sketch: 'q', height: 3 }],
      interfaces: [{ id: 'base', role: 'boss-base', accepts: ['body-face'], frame: { origin: [0, 0, 0], z: [0, 0, -1], x: [1, 0, 0] } }] }] }, 'user');
  const doc = plate(2.5), b0 = bodies(doc)[0];
  const assumed = addLibraryPartToBody(doc, 'test-strain', 'tab', {}, top(2.5, 20, 20)) as { node: LibraryNode };
  assert.ok(assumed.node.warnings.includes('context eps: the body\'s material is not set'), assumed.node.warnings.join(' | '));
  for (const [id, pass] of [['abs', true], ['pla', false]] as const) {
    const set = withLook(doc, b0, { material: id });
    const r = addLibraryPartToBody(set, 'test-strain', 'tab', {}, top(2.5, 20, 20)) as { node: LibraryNode };
    assert.equal(r.node.context!.eps, materialData(id)!.allowableStrain);
    assert.equal(r.node.warnings.some(x => x.startsWith('strain:')), !pass, `${id}: ${r.node.warnings.join(' | ')}`);
  }
});

test('R6b.3 cantilever snap hook: its volume the closed form; its root strain read against the body\'s material — met on ABS, warned on PLA, refused past PLA\'s yield, unknown without a material; library_check gives ε / allowable', async () => {
  const { withLook } = await import('@barocss/cad-model/app/bodies');
  const { runCheck } = await import('@barocss/cad-model/chat/spec');
  const doc = plate(3), b0 = bodies(doc)[0];
  const snap = (material: string | null, params: Record<string, number> = {}, d: StudioDoc = doc) => addLibraryPartToBody(material ? withLook(d, b0, { material }) : d, 'enclosure', 'snap-hook', { params }, top(3, 30, 20));
  // (A uniform beam: ε = 1.5 × 1.5 × 1 / 12² = 0.015625.)
  const eps = 1.5 * 1.5 * 1 / 144;
  const abs = snap('abs') as { doc: StudioDoc; node: LibraryNode };
  assert.deepEqual([abs.node.context!.epsAllow, abs.node.context!.E, abs.node.context!.ys, abs.node.context!.mu], [0.025, 2200, 40, 0.5]);
  assert.ok(!abs.node.warnings.some(w => /^(strain|yield)/.test(w)), abs.node.warnings.join(' | '));
  // (A 1.5 × 6 beam 12 long, a 1 × 2 hook: (1.5 × 14 + 1 × 2 / 2) × 6.)
  assert.ok(Math.abs(bodies(abs.doc)[0].volumeMM3! - (60 * 40 * 3 + (1.5 * 14 + 1) * 6)) < 1e-6);
  const pla = snap('pla') as { node: LibraryNode };
  assert.ok(pla.node.warnings.some(w => w === `strain: the beam is strained past the material's allowable strain on assembly (${+(eps / 0.015).toFixed(6)})`), pla.node.warnings.join(' | '));
  assert.match((snap('pla', { y: 1.5 }) as { error: string }).error, /yield: the beam would yield on assembly .* \(1\.49/);
  const none = snap(null) as { node: LibraryNode };
  assert.ok(none.node.warnings.some(w => /^strain: unknown — needs epsAllow/.test(w)) && none.node.warnings.includes("context epsAllow: the body's material is not set"));
  const ev = async () => evaluateDoc(abs.doc, 1), q = await runCheck(abs.doc, bodies(abs.doc), ev as never, { op: '<=', query: { fn: 'library_check', feature: abs.doc.nodes[2].id!, check: 'strain' }, value: 1 });
  assert.equal(q.status, 'pass'); assert.ok(Math.abs((q.measured as number) - +(eps / 0.025).toFixed(4)) < 1e-9);
});

test('R6b.3 the tapered beam: its root strain and deflection force checked against an independent numerical integration of the beam\'s deflection (Simpson, 20 000 steps over Euler–Bernoulli), for taper ratios 1, 0.8, 0.6, 0.45', () => {
  const lib = libraryById('enclosure')!, E = 2200, L = 12, t = 1.5, b = 6, y = 1;
  for (const r of [1, 0.8, 0.6, 0.45]) {
    const i = instantiateLibraryPart(lib, 'snap-hook', { params: { r }, context: { epsAllow: 0.025, E, ys: 40, mu: 0.5, isFdm: 0 } });
    // The tip deflection for a unit load: ∫₀ᴸ (L − x)² / (E I(x)) dx, I = b t(x)³ / 12, t(x) = t (1 − (1 − r) x / L).
    const n = 20000, h = L / n, f = (x: number) => (L - x) ** 2 / (E * b * (t * (1 - (1 - r) * x / L)) ** 3 / 12);
    let integral = f(0) + f(L);
    for (let k = 1; k < n; k++) integral += (k % 2 ? 4 : 2) * f(k * h);
    integral *= h / 3;
    const P = y / integral, rootStrain = P * L * (t / 2) / (E * b * t ** 3 / 12);
    assert.ok(Math.abs(i.values.eps / rootStrain - 1) < 1e-9, `r ${r}: ${i.values.eps} vs ${rootStrain}`);
    const force = i.reports.find(x => x.id === 'deflectionForce')!.value!;
    assert.ok(Math.abs(force / P - 1) < 1e-9, `r ${r}: P ${force} vs ${P}`);
  }
});

test('R6b.3 forces and the other rules: push-on W = P (μ + tan α) / (1 − μ tan α) from the lead angle, pull-off by the same form from the retaining angle (a square one locks: −1); a lead so steep it locks refused; a hook too short for its retaining face refused; FDM wants the bend in the print plane — unknown until the orientation is known, warned when given out of it; unknown μ leaves the forces unknown', () => {
  const lib = libraryById('enclosure')!, ctx = { epsAllow: 0.025, E: 2200, ys: 40, mu: 0.5, isFdm: 0 };
  const report = (i: ReturnType<typeof instantiateLibraryPart>, id: string) => i.reports.find(x => x.id === id)!;
  const i = instantiateLibraryPart(lib, 'snap-hook', { context: ctx }), P = 2200 * 6 * 1.5 ** 3 * 1 / (4 * 12 ** 3), ta = 1 / 2;
  assert.ok(Math.abs(report(i, 'deflectionForce').value! - P) < 1e-12);
  assert.ok(Math.abs(report(i, 'pushOn').value! - P * (0.5 + ta) / (1 - 0.5 * ta)) < 1e-12);
  assert.equal(report(i, 'pullOff').value, -1);
  // A 30° retaining face lets go: its rise 1/tan 30° = 1.732 under a 4 mm head.
  const r30 = instantiateLibraryPart(lib, 'snap-hook', { params: { ar: 30, hh: 4 }, context: ctx }), t30 = Math.tan(Math.PI / 6), a30 = Math.atan(1 / (4 - 1 / t30));
  assert.ok(Math.abs(report(r30, 'pullOff').value! - P * (0.5 + t30) / (1 - 0.5 * t30)) < 1e-9);
  assert.ok(Math.abs(report(r30, 'pushOn').value! - P * (0.5 + Math.tan(a30)) / (1 - 0.5 * Math.tan(a30))) < 1e-9);
  assert.throws(() => instantiateLibraryPart(lib, 'snap-hook', { params: { hh: 0.4 }, context: ctx }), (e: Error) => /lead-locks: the lead face is so steep it locks/.test(e.message));
  assert.throws(() => instantiateLibraryPart(lib, 'snap-hook', { params: { ar: 30, hh: 1.5 }, context: ctx }), (e: Error) => /shape: the hook is too short/.test(e.message));
  // FDM: the orientation unknown — said; given out of plane — warned; moulded — no question.
  const fdm = addLibraryPartToBody(plate(3, 'fdm'), 'enclosure', 'snap-hook', {}, top(3, 30, 20)) as { node: LibraryNode };
  assert.ok(fdm.node.warnings.includes('context bendInPlane: the print orientation is not known yet (it arrives with AM2/AM4)') && fdm.node.warnings.some(w => /^print-plane: unknown/.test(w)), fdm.node.warnings.join(' | '));
  const out = instantiateLibraryPart(lib, 'snap-hook', { context: { ...ctx, isFdm: 1, bendInPlane: 0 } });
  assert.ok(out.warnings.some(w => /^print-plane: printed in layers/.test(w)));
  assert.equal(instantiateLibraryPart(lib, 'snap-hook', { context: ctx }).checks.find(c => c.id === 'print-plane')!.pass, true);
  const noMu = instantiateLibraryPart(lib, 'snap-hook', { context: { epsAllow: 0.025, E: 2200, ys: 40, isFdm: 0 } });
  assert.equal(report(noMu, 'pushOn').value, null); assert.match(report(noMu, 'pushOn').unknown!, /needs mu/);
});

test('R6b.3 the hook latched under its ledge (a declared fit): no overlap, in contact, engaged; straight and tapered; a ledge shallower than the undercut by more than the clearance fails the fit\'s engagement rule', async () => {
  const { checkLibraryFit } = await import('@barocss/cad');
  const lib = libraryById('enclosure')!;
  for (const id of ['hook-on-ledge', 'tapered-hook-on-ledge']) {
    const r = checkLibraryFit(lib, id);
    assert.deepEqual([r.ok, r.overlapMM3, r.contact, r.checks.every(c => c.pass)], [true, 0, true, true], `${id}: ${JSON.stringify(r)}`);
  }
  const fit = lib.manifest.fits!.find(f => f.id === 'hook-on-ledge')!;
  // (A ledge only 0.75 deep under a 1 mm undercut: placed clear, in contact, but engaged 0.25 short — past the 0.2 clearance.)
  const shallow = checkLibraryFit(lib, { ...fit, a: { ...fit.a, params: { e: 0.75 } } });
  assert.deepEqual([shallow.overlapMM3, shallow.contact, shallow.ok], [0, true, false]);
  assert.deepEqual([shallow.checks.find(c => c.id === 'engagement')!.pass, shallow.checks.find(c => c.id === 'engagement')!.value], [false, -0.25]);
});

test('R6b.4 enclosure halves: the base (lip round the inside of its rim) and the lid (groove) build, their volumes the closed forms; the lid snapped onto the base by their rims; the declared fit clear and touching — a lip wider than the groove overlaps by exactly its excess ring; the clearance against the process (FDM wants more); a rim too thin refused', async () => {
  const { checkLibraryFit } = await import('@barocss/cad');
  const { emptyDoc } = await import('@barocss/cad-model/engine/doc');
  const { libraryInstance, snapByInterfaces } = await import('@barocss/cad-model/library/libraries');
  const lib = libraryById('enclosure')!, ctx = { minWall: 0.6, fitClearance: 0.1 };
  const L = 80, W = 50, w = 2, lt = 1, lh = 2, c = 0.2, hs = 20, Hl = 10, inner = (L - 2 * w) * (W - 2 * w);
  const { insertLibraryPart } = await import('@barocss/cad-model/library/libraries');
  const build = (part: string) => bodies(insertLibraryPart(emptyDoc(), 'enclosure', part))[0].volumeMM3!;
  assert.ok(Math.abs(build('enclosure-base') - (L * W * hs - inner * (hs - w) + ((L - 2 * w + 2 * lt) * (W - 2 * w + 2 * lt) - inner) * lh)) < 1e-6);
  assert.ok(Math.abs(build('enclosure-lid') - (L * W * Hl - inner * (Hl - w) - ((L - 2 * w + 2 * (lt + c)) * (W - 2 * w + 2 * (lt + c)) - inner) * (lh + c))) < 1e-6);
  // The declared fit: clear, touching on the rim, its rules met.
  const fit = checkLibraryFit(lib, 'lid-on-base');
  assert.deepEqual([fit.ok, fit.overlapMM3, fit.contact, fit.checks.map(x => x.pass)], [true, 0, true, [true, true, true]]);
  assert.ok(Math.abs(fit.checks.find(x => x.id === 'lip-side')!.value! - 0.2) < 1e-12);
  // A lid whose groove (0.7 + 0.2) is narrower than the 1 mm lip: they overlap by the 0.1 ring, 2 high.
  const def = lib.manifest.fits!.find(f => f.id === 'lid-on-base')!;
  const tight = checkLibraryFit(lib, { ...def, b: { ...def.b, params: { lt: 0.7 } } });
  const ring = (L - 2 * w + 2) * (W - 2 * w + 2) - (L - 2 * w + 1.8) * (W - 2 * w + 1.8);
  assert.equal(tight.ok, false); assert.ok(Math.abs(tight.overlapMM3 - ring * lh) < 1e-6, `${tight.overlapMM3} vs ${ring * lh}`);
  assert.equal(tight.checks.find(x => x.id === 'lip-side')!.pass, false);
  // In an assembly: the lid snapped onto the base's rim — one coincident mate on the rims, the lid on top.
  let doc = emptyDoc();
  ({ doc } = libraryInstance(doc, 'enclosure', 'enclosure-base', { name: 'Base' }));
  ({ doc } = libraryInstance(doc, 'enclosure', 'enclosure-lid', { name: 'Lid', position: [0, 0, 100] }));
  const snapped = snapByInterfaces(doc, { part: 'p1', interface: 'rim' }, { part: 'p2', interface: 'rim' }) as { doc: StudioDoc; mates: { kind: string }[] };
  assert.deepEqual(snapped.mates.map(m => m.kind), ['coincident']);
  assert.deepEqual(snapped.doc.instances!.find(i => i.id === 'p2')!.position.map(v => +v.toFixed(9)), [0, 0, 20]);
  // The clearance against the process: 0.15 fine for moulding, short for FDM (0.2).
  assert.equal(instantiateLibraryPart(lib, 'enclosure-lid', { params: { c: 0.15 }, context: ctx }).checks.find(x => x.id === 'clearance')!.pass, true);
  assert.equal(instantiateLibraryPart(lib, 'enclosure-lid', { params: { c: 0.15 }, context: { minWall: 0.8, fitClearance: 0.2 } }).checks.find(x => x.id === 'clearance')!.pass, false);
  // A lip leaving too thin a rim (2 − 1.6 = 0.4 under 0.6): refused.
  assert.throws(() => instantiateLibraryPart(lib, 'enclosure-base', { params: { lt: 1.6 }, context: ctx }), (e: Error) => /rim: the rim beside the lip is thinner than the process can make \(0\.4\)/.test(e.message));
});

test('R6b.5 vents and grilles: cut through the wall as deep as it is there (no further); the material taken exactly the openings; the open ratio reported; webs against the process (refused under its minimum, warned under its recommendation); in a box\'s side wall the far wall untouched', async () => {
  const { emptyDoc } = await import('@barocss/cad-model/engine/doc');
  const { insertLibraryPart } = await import('@barocss/cad-model/library/libraries');
  const plate2 = { ...rectanglePart(60, 40, 2), process: 'injection' };
  const before = bodies(plate2)[0].volumeMM3!;
  const vent = addLibraryPartToBody(plate2, 'enclosure', 'slot-vent', {}, top(2, 30, 20)) as { doc: StudioDoc; node: LibraryNode };
  assert.ok(!('error' in vent), JSON.stringify(vent));
  assert.equal(vent.node.library.params.cutDepth, 2.5);
  assert.ok(Math.abs(before - bodies(vent.doc)[0].volumeMM3! - 6 * 12 * 1.5 * 2) < 1e-6);
  const lib = libraryById('enclosure')!, ctx = { minWall: 0.6, minWallRec: 1.0 };
  const slots = instantiateLibraryPart(lib, 'slot-vent', { context: ctx });
  assert.ok(Math.abs(slots.reports.find(r => r.id === 'openRatio')!.value! - 9 / 19) < 1e-12);
  const hex = addLibraryPartToBody(plate2, 'enclosure', 'hex-grille', {}, top(2, 30, 20)) as { doc: StudioDoc; node: LibraryNode };
  assert.ok(!('error' in hex), JSON.stringify(hex));
  // (20 hexagons 4 across their flats, √3/2 · 16 each, 2 deep.)
  assert.ok(Math.abs(before - bodies(hex.doc)[0].volumeMM3! - 20 * Math.sqrt(3) / 2 * 16 * 2) < 1e-6);
  assert.ok(Math.abs(instantiateLibraryPart(lib, 'hex-grille', { context: ctx }).reports.find(r => r.id === 'openRatio')!.value! - 16 / 5.2 ** 2) < 1e-12);
  // One row: no staggered rows.
  const row = addLibraryPartToBody(plate2, 'enclosure', 'hex-grille', { params: { ny: 1 } }, top(2, 30, 20)) as { doc: StudioDoc };
  assert.ok(Math.abs(before - bodies(row.doc)[0].volumeMM3! - 5 * Math.sqrt(3) / 2 * 16 * 2) < 1e-6);
  // Webs: 0.5 refused, 0.8 warned under moulding.
  assert.throws(() => instantiateLibraryPart(lib, 'hex-grille', { params: { wb: 0.5 }, context: ctx }), (e: Error) => /web: the web between openings is thinner than the process can make \(0\.5\)/.test(e.message));
  assert.ok(instantiateLibraryPart(lib, 'hex-grille', { params: { wb: 0.8 }, context: ctx }).warnings.some(w => /^web-rec: .* \(0\.8\)$/.test(w)));
  // In the side wall of an enclosure base: the slots through its 2 mm wall only.
  const box = insertLibraryPart(emptyDoc(), 'enclosure', 'enclosure-base'), b = bodies(box)[0];
  const side = addLibraryPartToBody(box, 'enclosure', 'slot-vent', {}, { body: b.ref!, face: 'lib1_ob.side0', point: [40, 0, 10], normal: [0, -1, 0], xDir: [1, 0, 0] }) as { doc: StudioDoc };
  assert.ok(!('error' in side), JSON.stringify(side));
  assert.ok(Math.abs(b.volumeMM3! - bodies(side.doc)[0].volumeMM3! - 6 * 12 * 1.5 * 2) < 1e-6, 'only the near wall cut');
});

test('R6b.6 living hinge: a groove across a PP plate leaving its thickness — the material taken exactly; its thickness and strain against PP\'s living-hinge values; ABS is not a living-hinge material (unknown, said); FDM warned; a short land strained past PP\'s value warned; a hinge as thick as the plate refused', async () => {
  const { withLook } = await import('@barocss/cad-model/app/bodies');
  const pl = { ...rectanglePart(60, 40, 2), process: 'injection' }, b0 = bodies(pl)[0];
  const at = { ...top(2, 30, 20), xDir: [1, 0, 0] as [number, number, number] };
  const hinge = (material: string, doc: StudioDoc = pl, params: Record<string, number> = {}) => addLibraryPartToBody(withLook(doc, b0, { material }), 'enclosure', 'living-hinge', { params }, at);
  const pp = hinge('pp') as { doc: StudioDoc; node: LibraryNode };
  assert.ok(!('error' in pp), JSON.stringify(pp));
  assert.equal(pp.node.library.params.wallT, 2);
  // (1.5 land × 40 span × 1.7 deep.)
  assert.ok(Math.abs(b0.volumeMM3! - bodies(pp.doc)[0].volumeMM3! - 1.5 * 40 * 1.7) < 1e-6);
  assert.ok(!pp.node.warnings.some(w => /^(thickness|strain|process)/.test(w)), pp.node.warnings.join(' | '));
  const abs = hinge('abs') as { node: LibraryNode };
  assert.ok(abs.node.warnings.includes('context hingeStrain: ABS is not a living-hinge material') && abs.node.warnings.some(w => /^strain: unknown/.test(w)), abs.node.warnings.join(' | '));
  const fdm = hinge('pp', { ...pl, process: 'fdm' }) as { node: LibraryNode };
  assert.ok(fdm.node.warnings.some(w => /^process: a printed living hinge is weak/.test(w)));
  // (A 0.5 land: ε = 0.3 π / 1 = 0.942, past 0.5.)
  const short = hinge('pp', pl, { Lh: 0.5 }) as { node: LibraryNode };
  assert.ok(short.node.warnings.some(w => w.startsWith('strain:') && /\(1\.88/.test(w)), short.node.warnings.join(' | '));
  assert.ok((hinge('pp', pl, { th: 0.8 }) as { node: LibraryNode }).node.warnings.some(w => /^thickness: .* \(0\.8\)$/.test(w)));
  assert.match((hinge('pp', pl, { th: 1.9 }) as { error: string }).error, /thins: the hinge is not thinner than the plate/);
});

test('O72: a snap hook in a part whose brief states its material takes strain and yield from it — no context numbers; an assumed brief material, none; the body\'s own material first', async () => {
  const { dispatchTool } = await import('@barocss/cad-model/chat/tools'), { withLook } = await import('@barocss/cad-model/app/bodies');
  const stated = (value: string, basis: 'stated' | 'assumed' = 'stated'): StudioDoc => ({ ...plate(3), brief: { version: 1, material: { value, basis, ...(basis === 'stated' ? { source: value } : { why: 'a guess' }) } } as never });
  type Hook = { doc: StudioDoc; node: { context?: Record<string, number>; warnings: string[] } };
  const abs = addLibraryPartToBody(stated('abs'), 'enclosure', 'snap-hook', {}, top(3, 30, 20)) as Hook;
  assert.deepEqual([abs.node.context!.epsAllow, abs.node.context!.E, abs.node.context!.ys, abs.node.context!.mu], [0.025, 2200, 40, 0.5]);
  assert.ok(!abs.node.warnings.some(w => /material is not set|^strain: unknown|^yield: unknown/.test(w)), abs.node.warnings.join(' | '));
  // (Assumed, not stated: no material — said, as before.)
  const guess = addLibraryPartToBody(stated('abs', 'assumed'), 'enclosure', 'snap-hook', {}, top(3, 30, 20)) as Hook;
  assert.ok(guess.node.warnings.includes("context epsAllow: the body's material is not set"), guess.node.warnings.join(' | '));
  // (The body's own material before the brief's: PLA set on it, ABS in the brief — PLA's allowable strain.)
  const own = addLibraryPartToBody(withLook(stated('abs'), bodies(stated('abs'))[0], { material: 'pla' }), 'enclosure', 'snap-hook', {}, top(3, 30, 20)) as Hook;
  assert.equal(own.node.context!.epsAllow, 0.015);
  // (And through the agent's tools: set_brief with the user's words, then add_library_part — no context passed.)
  const ev = async (d: StudioDoc) => evaluateDoc(d, 1);
  let s = { doc: plate(3), bodies: bodies(plate(3)), turns: ['a clip in ABS'] } as never as Parameters<typeof dispatchTool>[0];
  let r = await dispatchTool(s, 'set_brief', { fields: { purpose: { value: 'a clip', basis: 'stated', source: 'a clip' }, process: { value: 'fdm', basis: 'stated', source: 'in ABS' }, material: { value: 'abs', basis: 'stated', source: 'ABS' } } }, ev); assert.ok(!r.isError, r.content); s = r.state;
  r = await dispatchTool(s, 'add_library_part', { library: 'enclosure', part: 'snap-hook', face: 'n1.top', point: [30, 20, 3] }, ev); assert.ok(!r.isError, r.content);
  const node = r.state.doc.nodes.at(-1) as { context?: Record<string, number> };
  assert.equal(node.context!.epsAllow, 0.025);
});

test('O72: two library parts in one turn through the agent\'s tools — the second finds the body the first was united into (the state\'s bodies re-evaluated)', async () => {
  const { dispatchTool } = await import('@barocss/cad-model/chat/tools'), { emptyDoc } = await import('@barocss/cad-model/engine/doc');
  const ev = async (d: StudioDoc) => evaluateDoc(d, 1);
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as Parameters<typeof dispatchTool>[0];
  for (const [tool, args] of [['run_command', { command: 'box', values: { w: 100, d: 70, h: 30, x: 0, y: 0, z: 0 } }], ['run_command', { command: 'shell', values: { t: 2 }, faces: ['n1.top'] }],
    ...[[20, 20], [80, 20], [80, 50], [20, 50]].map(([x, y]) => ['add_library_part', { library: 'enclosure', part: 'pcb-standoff', variant: 'M2.5', params: { h: 6 }, face: 'n2.floor', point: [x, y, 2] }])] as [string, Record<string, unknown>][]) {
    const r = await dispatchTool(s, tool, args, ev); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state;
  }
  assert.equal(s.doc.nodes.filter(n => n.kind === 'library').length, 4);
  assert.equal(s.bodies.length, 1); assert.equal(s.bodies[0].ref!.node, s.doc.nodes.length - 1, 'the state\'s body is the last union\'s');
});

test('O73: set_material — a body of the base part or of a placed part made of a library material: its mass, the BOM and a library part\'s context read it; an unknown id refused with the list', async () => {
  const { dispatchTool } = await import('@barocss/cad-model/chat/tools'), { emptyDoc } = await import('@barocss/cad-model/engine/doc'), { bomView } = await import('@barocss/cad-model/team/assembly');
  const ev = async (d: StudioDoc) => evaluateDoc(d, 1);
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as Parameters<typeof dispatchTool>[0];
  const call = async (tool: string, args: Record<string, unknown>) => { const r = await dispatchTool(s, tool, args, ev); assert.ok(!r.isError, `${tool}: ${r.content}`); s = r.state; return JSON.parse(r.content); };
  await call('run_command', { command: 'box', values: { w: 40, d: 20, h: 3, x: 0, y: 0, z: 0 } });
  await call('set_material', { material: 'abs' });
  const m = await call('mass_properties', {});
  assert.equal(m.bodies[0].mass_g, +(2400 * 1.04 / 1000).toFixed(3)); assert.equal(m.note, undefined, 'set, not assumed');
  // (A library part on it takes ABS's strain: no brief, no context.)
  const hook = await call('add_library_part', { library: 'enclosure', part: 'snap-hook', face: 'n1.top', point: [20, 10, 3] });
  assert.equal(hook.context.epsAllow, 0.025);
  // (A placed part: its own body, its BOM row.)
  await call('add_part', { name: 'Pin' }); await call('run_command', { part: 'p1', command: 'cylinder', values: { r: 2, h: 10, x: 0, y: 0, z: 0 } });
  assert.deepEqual(await call('set_material', { material: 'steel', part: 'p1' }), { part: 'p1', ok: true, bodies: ['b1'], material: 'steel' });
  assert.equal((await bomView(s.doc, ev)).parts[0].material, 'steel');
  const bad = await dispatchTool(s, 'set_material', { material: 'unobtainium' }, ev);
  assert.ok(bad.isError); assert.match(JSON.parse(bad.content).error, /^\[MATERIAL_UNKNOWN\] "unobtainium" .*materials: al6061, /);
  assert.ok((await dispatchTool(s, 'set_material', { material: 'abs', part: 'p9' }, ev)).isError);
  assert.ok((await dispatchTool(s, 'set_material', { material: 'abs', bodies: ['b9'] }, ev)).isError);
});
